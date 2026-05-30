"""
Ingest ASER CSV into aser_outcomes table, then patch district_features
with real state-level reading/arithmetic scores.

Usage (from backend/):
    DATABASE_URL=... python ingest_aser.py /path/to/aser_5year_dataset.csv
"""

import asyncio
import csv
import json
import os
import sys

import asyncpg
from dotenv import load_dotenv

load_dotenv()


async def ingest(csv_path: str):
    db_url = os.environ["DATABASE_URL"]
    conn = await asyncpg.connect(db_url)

    print("Applying schema (aser_outcomes table)...")
    schema_path = os.path.join(os.path.dirname(__file__), "db", "schema.sql")
    with open(schema_path) as f:
        await conn.execute(f.read())

    print(f"Loading {csv_path}...")
    with open(csv_path, newline="") as f:
        rows = list(csv.DictReader(f))

    print(f"Inserting {len(rows)} ASER rows...")
    inserted = 0
    for row in rows:
        try:
            await conn.execute(
                """
                INSERT INTO aser_outcomes
                    (year, state, region, grade, subject, metric,
                     pct_all_schools, pct_govt, pct_pvt, data_type, source)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                ON CONFLICT (year, state, grade, subject, metric) DO UPDATE SET
                    pct_all_schools = EXCLUDED.pct_all_schools,
                    pct_govt        = EXCLUDED.pct_govt,
                    pct_pvt         = EXCLUDED.pct_pvt
                """,
                int(row["year"]),
                row["state"],
                row["region"],
                int(row["grade"]),
                row["subject"],
                row["metric"],
                float(row["pct_all_schools"]) if row["pct_all_schools"] else None,
                float(row["pct_govt"]) if row["pct_govt"] else None,
                float(row["pct_pvt"]) if row["pct_pvt"] else None,
                row["data_type"],
                row["source"],
            )
            inserted += 1
        except Exception as e:
            print(f"  skip row {row}: {e}")

    print(f"Inserted/updated {inserted} rows into aser_outcomes.")

    # Build state → metric lookup for 2022 and 2023
    aser_rows = await conn.fetch("SELECT * FROM aser_outcomes ORDER BY year, state")

    def key(state, year, grade, subject, metric):
        return (state.lower(), year, grade, subject, metric)

    lookup: dict = {}
    for r in aser_rows:
        k = key(r["state"], r["year"], r["grade"], r["subject"], r["metric"])
        # prefer pct_govt; fall back to pct_all_schools (ASER 2023 omits school-type split)
        v = r["pct_govt"] if r["pct_govt"] is not None else r["pct_all_schools"]
        lookup[k] = v

    def get_pct(state, year, grade, subject, metric):
        v = lookup.get(key(state, year, grade, subject, metric))
        return round(v / 100.0, 4) if v is not None else None

    # Patch district_features with real ASER values
    district_rows = await conn.fetch("SELECT id, state FROM districts")
    patched = 0
    skipped = 0

    for d in district_rows:
        state = d["state"]

        reading_2023  = get_pct(state, 2023, 3, "reading",    "can_read_story")
        reading_2022  = get_pct(state, 2022, 3, "reading",    "can_read_story")
        arith_2023    = get_pct(state, 2023, 5, "arithmetic", "can_do_division")

        if reading_2023 is None:
            skipped += 1
            continue

        yoy = round(reading_2023 - reading_2022, 4) if reading_2022 is not None else None

        existing = await conn.fetchrow(
            "SELECT features FROM district_features WHERE district_id=$1 AND year=2023",
            d["id"],
        )
        if not existing:
            skipped += 1
            continue

        features = json.loads(existing["features"])
        features["reading_grade3_pct"] = reading_2023
        if arith_2023 is not None:
            features["arithmetic_grade5_pct"] = arith_2023
        if yoy is not None:
            features["yoy_delta_reading"] = yoy

        await conn.execute(
            "UPDATE district_features SET features=$1 WHERE district_id=$2 AND year=2023",
            json.dumps(features),
            d["id"],
        )
        patched += 1

    print(f"Patched {patched} district feature rows with real ASER scores ({skipped} skipped — no state match).")

    await conn.close()
    print("\nDone.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ingest_aser.py <path_to_csv>")
        sys.exit(1)
    asyncio.run(ingest(sys.argv[1]))

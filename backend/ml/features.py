import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "reading_grade3_pct",
    "arithmetic_grade5_pct",
    "yoy_delta_reading",
    "gender_gap_reading",
    "ndvi_seasonal_variance",
    "flood_days_per_year_avg",
    "road_connectivity_index",
    "teacher_vacancy_rate",
    "ptr",
    "infrastructure_score",
    "vacancy_portal_open_posts",
    "news_migration_signal",
    "news_flood_signal",
    "forum_absenteeism_complaints",
]


async def load_feature_matrix():
    from db.session import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT df.district_id, df.features
            FROM district_features df
            JOIN (
                SELECT district_id, MAX(year) AS max_year
                FROM district_features
                GROUP BY district_id
            ) latest ON df.district_id = latest.district_id AND df.year = latest.max_year
        """)

    district_ids = []
    records = []
    for row in rows:
        district_ids.append(str(row["district_id"]))
        feat = row["features"]
        records.append({col: float(feat.get(col) or 0.0) for col in FEATURE_COLUMNS})

    df = pd.DataFrame(records, columns=FEATURE_COLUMNS)
    return district_ids, df

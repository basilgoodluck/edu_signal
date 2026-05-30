"""
Seed 30 sample districts with features, cluster assignments, and interventions.
Run from backend/ directory:
    python seed.py

Safe to run multiple times — truncates and re-seeds each run.
"""

import asyncio
import json
import os
import random
from datetime import date

import asyncpg
from dotenv import load_dotenv

load_dotenv()

random.seed(42)

# (name, state, lat, lng, cluster_label, cluster_id)
DISTRICTS = [
    # cluster 0 — seasonal_migration (UP/Bihar harvest belt)
    ("Shravasti", "Uttar Pradesh", 27.57, 81.92, "seasonal_migration", 0),
    ("Lakhimpur Kheri", "Uttar Pradesh", 27.95, 80.79, "seasonal_migration", 0),
    ("Bahraich", "Uttar Pradesh", 27.57, 81.59, "seasonal_migration", 0),
    ("Sitapur", "Uttar Pradesh", 27.56, 80.68, "seasonal_migration", 0),
    ("Gonda", "Uttar Pradesh", 27.13, 81.97, "seasonal_migration", 0),
    ("Balrampur", "Uttar Pradesh", 27.42, 82.18, "seasonal_migration", 0),
    ("Katihar", "Bihar", 25.54, 87.57, "seasonal_migration", 0),
    # cluster 1 — teacher_shortage (Bihar/Jharkhand)
    ("Sheohar", "Bihar", 26.52, 85.29, "teacher_shortage", 1),
    ("Araria", "Bihar", 26.15, 87.47, "teacher_shortage", 1),
    ("Supaul", "Bihar", 26.12, 86.60, "teacher_shortage", 1),
    ("Kishanganj", "Bihar", 26.10, 87.95, "teacher_shortage", 1),
    ("Darbhanga", "Bihar", 26.16, 85.90, "teacher_shortage", 1),
    ("Madhubani", "Bihar", 26.36, 86.07, "teacher_shortage", 1),
    ("Dumka", "Jharkhand", 24.27, 87.25, "teacher_shortage", 1),
    # cluster 2 — infrastructure (flood-prone / tribal)
    ("Chitrakoot", "Uttar Pradesh", 25.18, 80.88, "infrastructure", 2),
    ("Sonbhadra", "Uttar Pradesh", 24.68, 83.06, "infrastructure", 2),
    ("Pakur", "Jharkhand", 24.64, 87.84, "infrastructure", 2),
    ("Godda", "Jharkhand", 24.83, 87.21, "infrastructure", 2),
    ("Barwani", "Madhya Pradesh", 22.03, 74.90, "infrastructure", 2),
    ("Shivpuri", "Madhya Pradesh", 25.43, 77.66, "infrastructure", 2),
    # cluster 3 — language_barrier (Karnataka/WB)
    ("Raichur", "Karnataka", 16.20, 77.36, "language_barrier", 3),
    ("Yadgir", "Karnataka", 16.77, 77.14, "language_barrier", 3),
    ("Koppal", "Karnataka", 15.35, 76.15, "language_barrier", 3),
    ("Murshidabad", "West Bengal", 24.18, 88.27, "language_barrier", 3),
    ("North 24 Parganas", "West Bengal", 22.85, 88.41, "language_barrier", 3),
    # cluster 4 — pedagogical_failure (infrastructure ok, still failing)
    ("Tikamgarh", "Madhya Pradesh", 24.74, 78.83, "pedagogical_failure", 4),
    ("Dungarpur", "Rajasthan", 23.84, 73.72, "pedagogical_failure", 4),
    ("Jaisalmer", "Rajasthan", 26.92, 70.91, "pedagogical_failure", 4),
    ("Sirohi", "Rajasthan", 24.89, 72.86, "pedagogical_failure", 4),
    ("Banka", "Bihar", 24.88, 86.93, "pedagogical_failure", 4),
]

FEATURE_PROFILES = {
    "seasonal_migration": {
        "reading_grade3_pct": (0.20, 0.35),
        "arithmetic_grade5_pct": (0.22, 0.38),
        "yoy_delta_reading": (-0.04, 0.01),
        "gender_gap_reading": (0.04, 0.10),
        "ndvi_seasonal_variance": (0.60, 0.85),
        "flood_days_per_year_avg": (3.0, 14.0),
        "road_connectivity_index": (0.40, 0.65),
        "teacher_vacancy_rate": (0.10, 0.22),
        "ptr": (28.0, 42.0),
        "infrastructure_score": (0.40, 0.62),
        "vacancy_portal_open_posts": (4, 14),
        "news_migration_signal": (0.65, 0.90),
        "news_flood_signal": (0.10, 0.30),
        "forum_absenteeism_complaints": (10, 35),
    },
    "teacher_shortage": {
        "reading_grade3_pct": (0.15, 0.30),
        "arithmetic_grade5_pct": (0.18, 0.32),
        "yoy_delta_reading": (-0.03, 0.02),
        "gender_gap_reading": (0.05, 0.12),
        "ndvi_seasonal_variance": (0.20, 0.48),
        "flood_days_per_year_avg": (2.0, 10.0),
        "road_connectivity_index": (0.35, 0.60),
        "teacher_vacancy_rate": (0.40, 0.60),
        "ptr": (45.0, 65.0),
        "infrastructure_score": (0.42, 0.65),
        "vacancy_portal_open_posts": (18, 45),
        "news_migration_signal": (0.08, 0.30),
        "news_flood_signal": (0.08, 0.25),
        "forum_absenteeism_complaints": (20, 50),
    },
    "infrastructure": {
        "reading_grade3_pct": (0.20, 0.36),
        "arithmetic_grade5_pct": (0.22, 0.38),
        "yoy_delta_reading": (-0.05, 0.00),
        "gender_gap_reading": (0.04, 0.11),
        "ndvi_seasonal_variance": (0.25, 0.55),
        "flood_days_per_year_avg": (22.0, 50.0),
        "road_connectivity_index": (0.18, 0.40),
        "teacher_vacancy_rate": (0.06, 0.20),
        "ptr": (26.0, 40.0),
        "infrastructure_score": (0.18, 0.38),
        "vacancy_portal_open_posts": (2, 10),
        "news_migration_signal": (0.08, 0.28),
        "news_flood_signal": (0.60, 0.88),
        "forum_absenteeism_complaints": (8, 30),
    },
    "language_barrier": {
        "reading_grade3_pct": (0.15, 0.30),
        "arithmetic_grade5_pct": (0.20, 0.38),
        "yoy_delta_reading": (-0.02, 0.02),
        "gender_gap_reading": (0.15, 0.28),
        "ndvi_seasonal_variance": (0.20, 0.45),
        "flood_days_per_year_avg": (3.0, 12.0),
        "road_connectivity_index": (0.45, 0.72),
        "teacher_vacancy_rate": (0.08, 0.22),
        "ptr": (28.0, 42.0),
        "infrastructure_score": (0.45, 0.70),
        "vacancy_portal_open_posts": (2, 10),
        "news_migration_signal": (0.08, 0.25),
        "news_flood_signal": (0.06, 0.22),
        "forum_absenteeism_complaints": (5, 20),
    },
    "pedagogical_failure": {
        "reading_grade3_pct": (0.25, 0.40),
        "arithmetic_grade5_pct": (0.28, 0.44),
        "yoy_delta_reading": (-0.01, 0.03),
        "gender_gap_reading": (0.03, 0.09),
        "ndvi_seasonal_variance": (0.22, 0.50),
        "flood_days_per_year_avg": (2.0, 10.0),
        "road_connectivity_index": (0.55, 0.82),
        "teacher_vacancy_rate": (0.04, 0.15),
        "ptr": (22.0, 34.0),
        "infrastructure_score": (0.62, 0.85),
        "vacancy_portal_open_posts": (0, 6),
        "news_migration_signal": (0.06, 0.25),
        "news_flood_signal": (0.05, 0.20),
        "forum_absenteeism_complaints": (3, 15),
    },
}

SHAP_TEMPLATES = {
    "seasonal_migration": {
        "ndvi_seasonal_variance": 0.43,
        "news_migration_signal": 0.31,
        "yoy_delta_reading": -0.19,
        "teacher_vacancy_rate": -0.05,
        "flood_days_per_year_avg": 0.02,
        "ptr": -0.01,
        "reading_grade3_pct": -0.08,
        "infrastructure_score": 0.01,
        "road_connectivity_index": 0.00,
        "vacancy_portal_open_posts": -0.02,
        "arithmetic_grade5_pct": -0.03,
        "gender_gap_reading": 0.01,
        "news_flood_signal": 0.00,
        "forum_absenteeism_complaints": 0.02,
    },
    "teacher_shortage": {
        "teacher_vacancy_rate": 0.52,
        "ptr": 0.28,
        "vacancy_portal_open_posts": 0.18,
        "ndvi_seasonal_variance": -0.08,
        "infrastructure_score": 0.03,
        "reading_grade3_pct": -0.05,
        "news_migration_signal": -0.03,
        "road_connectivity_index": 0.01,
        "flood_days_per_year_avg": 0.00,
        "arithmetic_grade5_pct": -0.02,
        "gender_gap_reading": 0.01,
        "news_flood_signal": 0.00,
        "yoy_delta_reading": -0.01,
        "forum_absenteeism_complaints": 0.03,
    },
    "infrastructure": {
        "flood_days_per_year_avg": 0.47,
        "infrastructure_score": -0.35,
        "road_connectivity_index": -0.22,
        "news_flood_signal": 0.18,
        "teacher_vacancy_rate": 0.04,
        "reading_grade3_pct": -0.02,
        "ndvi_seasonal_variance": 0.01,
        "ptr": 0.01,
        "news_migration_signal": -0.01,
        "vacancy_portal_open_posts": 0.00,
        "arithmetic_grade5_pct": -0.01,
        "gender_gap_reading": 0.00,
        "yoy_delta_reading": -0.02,
        "forum_absenteeism_complaints": 0.01,
    },
    "language_barrier": {
        "gender_gap_reading": 0.38,
        "ndvi_seasonal_variance": -0.15,
        "news_migration_signal": -0.12,
        "infrastructure_score": 0.08,
        "forum_absenteeism_complaints": 0.06,
        "reading_grade3_pct": -0.04,
        "teacher_vacancy_rate": 0.02,
        "road_connectivity_index": 0.01,
        "flood_days_per_year_avg": -0.01,
        "ptr": 0.01,
        "arithmetic_grade5_pct": -0.03,
        "vacancy_portal_open_posts": 0.00,
        "news_flood_signal": -0.01,
        "yoy_delta_reading": 0.01,
    },
    "pedagogical_failure": {
        "infrastructure_score": -0.42,
        "teacher_vacancy_rate": -0.35,
        "ptr": -0.18,
        "reading_grade3_pct": 0.28,
        "news_migration_signal": -0.10,
        "ndvi_seasonal_variance": -0.05,
        "road_connectivity_index": -0.03,
        "flood_days_per_year_avg": -0.02,
        "vacancy_portal_open_posts": -0.01,
        "arithmetic_grade5_pct": 0.08,
        "gender_gap_reading": -0.02,
        "news_flood_signal": -0.01,
        "yoy_delta_reading": 0.01,
        "forum_absenteeism_complaints": -0.01,
    },
}

INTERVENTIONS = {
    "seasonal_migration": [
        (
            "Seasonal bridge curriculum",
            date(2022, 7, 1),
            0.12,
            "8-week catch-up program Oct-Dec for returning migrant children. Piloted in Lakhimpur Kheri, rolled out to 3 peer districts.",
        ),
        (
            "Harvest-season attendance incentive",
            date(2021, 10, 1),
            0.08,
            "Conditional Rs 500/month for 90%+ attendance Oct-Dec. Statistically significant improvement in Bahraich yr-2 ASER.",
        ),
    ],
    "teacher_shortage": [
        (
            "Para-teacher deployment",
            date(2021, 6, 1),
            0.09,
            "State-contracted graduates deployed to fill vacant posts with 6-month bridge training. Reduced PTR from 58 to 41 in Sheohar.",
        ),
        (
            "SMC-managed local hiring",
            date(2022, 1, 1),
            0.07,
            "School Management Committees empowered to hire local educated youth at state-approved honorarium. Araria pilot.",
        ),
    ],
    "infrastructure": [
        (
            "Emergency classroom reconstruction",
            date(2022, 3, 1),
            0.11,
            "NDRF-funded reconstruction of flood-damaged classrooms. 47 schools rebuilt in Pakur and Godda over 14 months.",
        ),
        (
            "Prefab mobile classroom units",
            date(2023, 1, 1),
            0.06,
            "Prefabricated classroom units deployed to 12 schools with worst infrastructure damage. Barwani district trial.",
        ),
    ],
    "language_barrier": [
        (
            "Mother tongue multilingual education (MT-MLE)",
            date(2021, 6, 1),
            0.15,
            "Grades 1-3 instruction in home language; Hindi/English as L2 from Grade 2. Largest ASER delta in Raichur, replicating Koppal.",
        ),
        (
            "Bilingual textbooks",
            date(2022, 6, 1),
            0.09,
            "District-printed bilingual textbooks — local language left page, Hindi right. Reduced drop-off rate in Yadgir.",
        ),
    ],
    "pedagogical_failure": [
        (
            "FLN structured daily lesson plans",
            date(2021, 6, 1),
            0.13,
            "NIPUN Mission-aligned lesson plans with activity-based learning rolled out to all primary schools in Tikamgarh.",
        ),
        (
            "Peer learning circles (4-child groups)",
            date(2022, 6, 1),
            0.10,
            "ASER-tested peer learning methodology across all primary schools. Dungarpur showed 0.10 reading score delta after 1 year.",
        ),
    ],
}

CLUSTER_METADATA = {
    "seasonal_migration": {
        "label": "Seasonal migration",
        "short": "Migration",
        "color": "#2563eb",
        "tint": "#dbeafe",
        "blurb": "Learning drops line up with harvest-season attendance loss and family mobility.",
        "window": "Oct-Dec return bridge",
        "signature": ["High NDVI variance", "Migration news signals", "Negative reading trend"],
    },
    "language_barrier": {
        "label": "Language barrier",
        "short": "Language",
        "color": "#7c3aed",
        "tint": "#ede9fe",
        "blurb": "Home language mismatch is associated with weaker early reading outcomes.",
        "window": "Grade 1-3 MT-MLE",
        "signature": ["Large gender/language gap", "Mixed-language regions", "Forum complaints"],
    },
    "teacher_shortage": {
        "label": "Teacher shortage",
        "short": "Staffing",
        "color": "#dc2626",
        "tint": "#fee2e2",
        "blurb": "High vacancy and PTR signals suggest constrained classroom attention.",
        "window": "June staffing cycle",
        "signature": ["High vacancy rate", "High PTR", "Open portal posts"],
    },
    "infrastructure": {
        "label": "Infrastructure disruption",
        "short": "Infra",
        "color": "#0891b2",
        "tint": "#cffafe",
        "blurb": "Flood exposure and weak connectivity point to physical access and facility constraints.",
        "window": "Pre-monsoon repair",
        "signature": ["Flood days", "Low infra score", "Weak road connectivity"],
    },
    "pedagogical": {
        "label": "Pedagogical gap",
        "short": "Pedagogy",
        "color": "#16a34a",
        "tint": "#dcfce7",
        "blurb": "Adequate inputs but weak foundational outcomes indicate classroom practice gaps.",
        "window": "Daily FLN block",
        "signature": ["Adequate infrastructure", "Low FLN conversion", "Low vacancy pressure"],
    },
    "noise": {
        "label": "Unclassified signal",
        "short": "Noise",
        "color": "#64748b",
        "tint": "#f1f5f9",
        "blurb": "Districts without a stable dominant root-cause signature.",
        "window": "Manual review",
        "signature": ["Low confidence", "Mixed evidence", "Insufficient signal"],
    },
}

SCAN_STEP_TEMPLATE = [
    (0, "Search news signals", "news"),
    (1, "Check vacancy portals", "vacancy_portal"),
    (2, "Review NGO reports", "ngo_report"),
    (3, "Scan community forums", "forum"),
    (4, "Classify evidence", "classifier"),
]

# Demo evidence for Shravasti (cluster 0)
SAMPLE_EVIDENCE = [
    {
        "raw_text": "TOI Gorakhpur, Oct 2024: Schools in sugarcane belt districts report 35-40% attendance drop as harvest season begins. Shravasti, Bahraich worst hit.",
        "source_url": "https://timesofindia.indiatimes.com/city/lucknow/",
        "source_type": "news",
        "classification": "Supporting",
        "reason": "Directly confirms seasonal agricultural migration pulling children from schools during harvest period.",
    },
    {
        "raw_text": "UP UPSESSB vacancy portal: Shravasti district — 0 new teacher postings this quarter. Total sanctioned posts: 312. Filled: 289.",
        "source_url": "https://upsessb.pariksha.nic.in/vacancy",
        "source_type": "vacancy_portal",
        "classification": "Contradicting",
        "reason": "Teacher vacancy rate is low (7%), contradicting the teacher shortage hypothesis for this district.",
    },
    {
        "raw_text": "ISRO Bhuvan NDVI analysis: Shravasti and adjacent districts show NDVI peak Sep-Nov (0.74) correlating with 18-year historical pattern of sugarcane and paddy harvest activity.",
        "source_url": "https://bhuvan.nrsc.gov.in/",
        "source_type": "ngo_report",
        "classification": "Supporting",
        "reason": "Satellite data directly links peak agricultural activity period to the months ASER records lowest attendance.",
    },
    {
        "raw_text": "State Education Department press release: New classroom construction in Shravasti completed across 14 schools under Samagra Shiksha Abhiyan.",
        "source_url": "https://upedu.gov.in/press",
        "source_type": "govt_press_release",
        "classification": "Irrelevant",
        "reason": "Classroom construction addresses infrastructure; Shravasti's problem is seasonal attendance, not building condition.",
    },
]


def make_features(cluster_label: str) -> dict:
    profile = FEATURE_PROFILES[cluster_label]
    result = {}
    for key, (lo, hi) in profile.items():
        if isinstance(lo, int):
            result[key] = random.randint(lo, hi)
        else:
            result[key] = round(random.uniform(lo, hi), 3)
    return result


def make_shap(cluster_label: str) -> dict:
    template = SHAP_TEMPLATES[cluster_label]
    return {
        k: round(v + random.uniform(-0.04, 0.04), 4)
        for k, v in template.items()
    }


async def seed():
    db_url = os.environ["DATABASE_URL"]
    conn = await asyncpg.connect(db_url)

    print("Initialising schema...")
    schema_path = os.path.join(os.path.dirname(__file__), "db", "schema.sql")
    with open(schema_path) as f:
        await conn.execute(f.read())

    print("Truncating tables...")
    await conn.execute("""
        TRUNCATE TABLE scan_steps, scan_runs, tracker_items, alerts, model_runs,
        evidence, interventions, cluster_assignments, district_features,
        cluster_metadata, districts
        RESTART IDENTITY CASCADE
    """)

    print("Inserting cluster metadata...")
    for cluster_id, meta in CLUSTER_METADATA.items():
        await conn.execute(
            """
            INSERT INTO cluster_metadata (id, label, short, color, tint, blurb, window, signature)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            cluster_id,
            meta["label"],
            meta["short"],
            meta["color"],
            meta["tint"],
            meta["blurb"],
            meta["window"],
            meta["signature"],
        )

    print("Inserting districts...")
    district_ids: dict[str, str] = {}  # name → id
    for name, state, lat, lng, cluster_label, cluster_id in DISTRICTS:
        row = await conn.fetchrow(
            """
            INSERT INTO districts (name, state, lat, lng)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            """,
            name, state, lat, lng,
        )
        district_ids[name] = str(row["id"])

    print("Inserting features (year 2023)...")
    for name, state, lat, lng, cluster_label, cluster_id in DISTRICTS:
        did = district_ids[name]
        features = make_features(cluster_label)
        await conn.execute(
            """
            INSERT INTO district_features (district_id, year, features)
            VALUES ($1, $2, $3)
            """,
            did, 2023, json.dumps(features),
        )

    print("Inserting cluster assignments...")
    for name, state, lat, lng, cluster_label, cluster_id in DISTRICTS:
        did = district_ids[name]
        shap_values = make_shap(cluster_label)
        confidence = round(random.uniform(0.72, 0.95), 3)
        await conn.execute(
            """
            INSERT INTO cluster_assignments (district_id, cluster_id, cluster_label, confidence, shap_values)
            VALUES ($1, $2, $3, $4, $5)
            """,
            did, cluster_id, cluster_label, confidence, json.dumps(shap_values),
        )

    print("Inserting interventions...")
    # Assign each intervention to the first district in that cluster
    cluster_first = {}
    for name, state, lat, lng, cluster_label, cluster_id in DISTRICTS:
        if cluster_label not in cluster_first:
            cluster_first[cluster_label] = district_ids[name]

    for cluster_label, ilist in INTERVENTIONS.items():
        did = cluster_first[cluster_label]
        for itype, started_at, aser_delta, notes in ilist:
            await conn.execute(
                """
                INSERT INTO interventions (district_id, intervention_type, started_at, aser_delta, notes)
                VALUES ($1, $2, $3, $4, $5)
                """,
                did, itype, started_at, aser_delta, notes,
            )

    print("Inserting demo evidence for Shravasti...")
    shravasti_id = district_ids["Shravasti"]
    for ev in SAMPLE_EVIDENCE:
        await conn.execute(
            """
            INSERT INTO evidence (district_id, raw_text, source_url, source_type, classification, reason)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            shravasti_id,
            ev["raw_text"],
            ev["source_url"],
            ev["source_type"],
            ev["classification"],
            ev["reason"],
        )

    print("Inserting demo scan run...")
    scan_row = await conn.fetchrow(
        """
        INSERT INTO scan_runs (district_id, status, sources, completed_at)
        VALUES ($1, 'complete', $2, NOW())
        RETURNING id
        """,
        shravasti_id,
        ["news", "vacancy_portal", "ngo_report", "forum"],
    )
    for step_index, label, source in SCAN_STEP_TEMPLATE:
        await conn.execute(
            """
            INSERT INTO scan_steps (scan_id, step_index, label, source, status)
            VALUES ($1, $2, $3, $4, 'done')
            """,
            str(scan_row["id"]),
            step_index,
            label,
            source,
        )

    print("Inserting demo alerts and tracker items...")
    demo_alerts = [
        ("high", "Shravasti", "Attendance drop detected", "Harvest-season evidence volume is rising against an already negative reading trend.", "seasonal_migration"),
        ("medium", "Sheohar", "Vacancy pressure elevated", "Teacher vacancy signals remain above peer-cluster norms.", "teacher_shortage"),
        ("low", "Pakur", "Flood watch", "Infrastructure evidence suggests pre-monsoon repairs should be monitored.", "infrastructure"),
    ]
    for level, district_name, title, body, cluster_id in demo_alerts:
        await conn.execute(
            """
            INSERT INTO alerts (level, district_id, title, body, cluster_id)
            VALUES ($1, $2, $3, $4, $5)
            """,
            level,
            district_ids[district_name],
            title,
            body,
            cluster_id,
        )

    demo_tracker = [
        ("Shravasti", "Seasonal bridge curriculum", date(2023, 10, 1), "active", 0.24, 0.29, 0.36, "Bridge groups running in return-migration blocks."),
        ("Raichur", "Mother tongue multilingual education (MT-MLE)", date(2023, 6, 1), "monitoring", 0.22, 0.31, 0.38, "Teacher guides distributed; classroom observation cycle in progress."),
        ("Tikamgarh", "FLN structured daily lesson plans", date(2022, 7, 1), "complete", 0.31, 0.40, 0.42, "Endline shows sustained gain, move to peer mentoring."),
    ]
    for district_name, intervention_type, started_at, status, baseline, latest, target, note in demo_tracker:
        await conn.execute(
            """
            INSERT INTO tracker_items (district_id, intervention_type, started_at, status, baseline, latest, target, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            district_ids[district_name],
            intervention_type,
            started_at,
            status,
            baseline,
            latest,
            target,
            note,
        )

    print("Inserting demo model run...")
    await conn.execute(
        """
        INSERT INTO model_runs (model_version, silhouette, projection_type, trained_at, projection_points)
        VALUES ($1, $2, $3, NOW(), $4)
        """,
        "latest",
        0.61,
        "umap",
        json.dumps([]),
    )

    await conn.close()
    print(f"\nSeed complete: {len(DISTRICTS)} districts, 6 clusters, {sum(len(v) for v in INTERVENTIONS.values())} interventions, {len(SAMPLE_EVIDENCE)} demo evidence cards.")
    print("\nDistrict IDs:")
    for name, did in district_ids.items():
        entry = next(d for d in DISTRICTS if d[0] == name)
        print(f"  {name} ({entry[4]}): {did}")


if __name__ == "__main__":
    asyncio.run(seed())

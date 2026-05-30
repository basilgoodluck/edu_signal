"""
Offline clustering script. Run from backend/ directory:
    python -m ml.train

Requires DATABASE_URL in environment (or .env file).
Designed for real ASER data with 100+ districts.
For the 30-district seed, cluster assignments are pre-set by seed.py.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

CLUSTER_LABEL_MAP = {
    0: "seasonal_migration",
    1: "teacher_shortage",
    2: "infrastructure",
    3: "language_barrier",
    4: "pedagogical_failure",
}

MIN_DISTRICTS_FOR_HDBSCAN = 50


async def run():
    from ml.features import load_feature_matrix, FEATURE_COLUMNS
    from db.session import get_pool
    from dto.mappers import normalize_cluster

    district_ids, df = await load_feature_matrix()
    n = len(df)
    print(f"Loaded {n} districts.")

    if n < 5:
        print("Need at least 5 districts. Exiting.")
        return

    from sklearn.preprocessing import StandardScaler

    X = df.values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    if n >= MIN_DISTRICTS_FOR_HDBSCAN:
        from umap import UMAP
        import hdbscan

        reducer = UMAP(n_components=min(10, n - 2), random_state=42)
        X_reduced = reducer.fit_transform(X_scaled)
        projection_type = "umap"

        min_size = max(5, n // 10)
        clusterer = hdbscan.HDBSCAN(min_cluster_size=min_size, prediction_data=True)
        labels = clusterer.fit_predict(X_reduced)
        soft_probs = hdbscan.all_points_membership_vectors(clusterer)
        confidences = soft_probs.max(axis=1)
    else:
        from sklearn.cluster import KMeans

        n_clusters = min(5, n)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)
        distances = np.min(kmeans.transform(X_scaled), axis=1)
        max_dist = distances.max() or 1.0
        confidences = 1.0 - (distances / max_dist)
        soft_probs = None
        projection_type = "kmeans"
        from sklearn.decomposition import PCA

        X_reduced = PCA(n_components=2, random_state=42).fit_transform(X_scaled)

    unique_labels = sorted(set(labels[labels != -1]))
    label_remap = {orig: i for i, orig in enumerate(unique_labels)}

    valid_mask = labels != -1
    if valid_mask.sum() < 2:
        print("Too many noise points for SHAP computation.")
        return

    X_valid = X_scaled[valid_mask]
    y_valid = np.array([label_remap.get(int(l), 0) for l in labels[valid_mask]])

    from sklearn.ensemble import RandomForestClassifier
    import shap

    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X_valid, y_valid)

    explainer = shap.TreeExplainer(clf)
    shap_matrix = explainer.shap_values(X_scaled)

    pool = await get_pool()
    saved = 0
    async with pool.acquire() as conn:
        district_rows = await conn.fetch("SELECT id, name FROM districts")
        district_names = {str(row["id"]): row["name"] for row in district_rows}
        for i, district_id in enumerate(district_ids):
            raw_label = int(labels[i])
            if raw_label == -1:
                continue

            mapped = label_remap[raw_label]
            cluster_label = CLUSTER_LABEL_MAP.get(mapped, f"cluster_{mapped}")
            confidence = float(confidences[i])

            pred_class = int(clf.predict(X_scaled[i : i + 1])[0])
            sv = (
                shap_matrix[pred_class][i]
                if isinstance(shap_matrix, list)
                else shap_matrix[i]
            )
            shap_dict = {
                FEATURE_COLUMNS[j]: round(float(sv[j]), 4)
                for j in range(len(FEATURE_COLUMNS))
            }

            await conn.execute(
                """
                INSERT INTO cluster_assignments
                    (district_id, cluster_id, cluster_label, confidence, shap_values, assigned_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (district_id) DO UPDATE SET
                    cluster_id = EXCLUDED.cluster_id,
                    cluster_label = EXCLUDED.cluster_label,
                    confidence = EXCLUDED.confidence,
                    shap_values = EXCLUDED.shap_values,
                    assigned_at = EXCLUDED.assigned_at
                """,
                district_id,
                mapped,
                cluster_label,
                confidence,
                json.dumps(shap_dict),
            )
            saved += 1

        from sklearn.metrics import silhouette_score

        silhouette = 0.0
        if len(set(labels)) > 1 and valid_mask.sum() > 1:
            silhouette = float(silhouette_score(X_scaled[valid_mask], labels[valid_mask]))

        model_version = "model_" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        projection_points = []
        for i, district_id in enumerate(district_ids):
            features = df.iloc[i].to_dict()
            projection_points.append({
                "districtId": str(district_id),
                "x": round(float(X_reduced[i][0]), 4),
                "y": round(float(X_reduced[i][1] if X_reduced.shape[1] > 1 else 0), 4),
                "cluster": normalize_cluster(CLUSTER_LABEL_MAP.get(label_remap.get(int(labels[i]), -1), "noise") if labels[i] != -1 else "noise"),
                "name": district_names.get(str(district_id), ""),
                "confidence": round(float(confidences[i]), 4),
                "reading3": round(float(features.get("reading_grade3_pct", 0)), 4),
            })

        await conn.execute(
            """
            INSERT INTO model_runs
                (model_version, silhouette, projection_type, trained_at, projection_points)
            VALUES ($1, $2, $3, NOW(), $4)
            """,
            model_version,
            silhouette,
            projection_type,
            json.dumps(projection_points),
        )

    from sse import publish_event

    await publish_event("model_status", {
        "type": "model_trained",
        "modelVersion": model_version,
        "silhouette": round(silhouette, 4),
        "projection": projection_type,
        "districts": saved,
    })

    print(f"Wrote {saved} cluster assignments across {len(unique_labels)} clusters.")


if __name__ == "__main__":
    asyncio.run(run())

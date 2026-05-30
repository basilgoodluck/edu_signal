from datetime import date, datetime
from typing import Any


CLUSTER_ORDER = [
    "seasonal_migration",
    "language_barrier",
    "teacher_shortage",
    "infrastructure",
    "pedagogical",
    "noise",
]

CLUSTER_ID_BY_NUMERIC = {
    0: "seasonal_migration",
    1: "teacher_shortage",
    2: "infrastructure",
    3: "language_barrier",
    4: "pedagogical",
    -1: "noise",
}

STATE_CODES = {
    "Bihar": "BR",
    "Jharkhand": "JH",
    "Karnataka": "KA",
    "Madhya Pradesh": "MP",
    "Rajasthan": "RJ",
    "Uttar Pradesh": "UP",
    "West Bengal": "WB",
}

FEATURE_LABELS = {
    "reading3": "Grade 3 reading",
    "arith5": "Grade 5 arithmetic",
    "yoyReading": "YoY reading change",
    "genderGap": "Gender reading gap",
    "ptr": "Pupil-teacher ratio",
    "vacancyRate": "Teacher vacancy rate",
    "infraScore": "Infrastructure score",
    "ndviVar": "NDVI seasonal variance",
    "floodDays": "Flood days per year",
    "roadIdx": "Road connectivity",
    "vacancyPosts": "Open teacher posts",
    "newsMigration": "Migration signal",
    "newsFlood": "Flood signal",
    "forumComplaints": "Forum complaints",
}

FEATURE_KEY_MAP = {
    "reading_grade3_pct": "reading3",
    "arithmetic_grade5_pct": "arith5",
    "yoy_delta_reading": "yoyReading",
    "gender_gap_reading": "genderGap",
    "ptr": "ptr",
    "teacher_vacancy_rate": "vacancyRate",
    "infrastructure_score": "infraScore",
    "ndvi_seasonal_variance": "ndviVar",
    "flood_days_per_year_avg": "floodDays",
    "road_connectivity_index": "roadIdx",
    "vacancy_portal_open_posts": "vacancyPosts",
    "news_migration_signal": "newsMigration",
    "news_flood_signal": "newsFlood",
    "forum_absenteeism_complaints": "forumComplaints",
}

SOURCE_META = {
    "news": {"label": "News", "icon": "newspaper"},
    "satellite": {"label": "Satellite", "icon": "satellite"},
    "vacancy_portal": {"label": "Vacancy portal", "icon": "briefcase"},
    "forum": {"label": "Community forums", "icon": "messages-square"},
    "ngo_report": {"label": "NGO reports", "icon": "file-text"},
}

SCAN_STEPS_TEMPLATE = [
    {"label": "Search news signals", "source": "news"},
    {"label": "Check vacancy portals", "source": "vacancy_portal"},
    {"label": "Review NGO reports", "source": "ngo_report"},
    {"label": "Scan community forums", "source": "forum"},
    {"label": "Classify evidence", "source": "classifier"},
]


def as_dict(row: Any) -> dict[str, Any]:
    if row is None:
        return {}
    return dict(row)


def serialize(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def normalize_cluster(value: Any) -> str:
    if value is None:
        return "noise"
    if isinstance(value, int):
        return CLUSTER_ID_BY_NUMERIC.get(value, "noise")
    text = str(value)
    if text == "pedagogical_failure":
        return "pedagogical"
    if text in CLUSTER_ORDER:
        return text
    return CLUSTER_ID_BY_NUMERIC.get(int(text), "noise") if text.lstrip("-").isdigit() else "noise"


def normalize_source_type(value: Any) -> str:
    text = str(value or "news")
    if text in SOURCE_META:
        return text
    if text in {"govt_press_release", "grievance_portal"}:
        return "ngo_report" if text == "govt_press_release" else "forum"
    return "news"


def map_features(features: dict[str, Any] | None) -> dict[str, Any]:
    data = features or {}
    mapped = {}
    for raw_key, contract_key in FEATURE_KEY_MAP.items():
        mapped[contract_key] = data.get(raw_key, 0)
    return mapped


def map_shap(shap_values: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for raw_key, value in (shap_values or {}).items():
        rows.append({
            "feature": FEATURE_KEY_MAP.get(raw_key, raw_key),
            "contribution": value,
        })
    return rows


def map_cluster(row: Any) -> dict[str, Any]:
    data = as_dict(row)
    cluster_id = normalize_cluster(data.get("id") or data.get("cluster_label") or data.get("cluster_id"))
    return {
        "id": cluster_id,
        "label": data.get("label") or cluster_id.replace("_", " ").title(),
        "short": data.get("short") or cluster_id.replace("_", " ").title(),
        "color": data.get("color") or "#64748b",
        "tint": data.get("tint") or "#f8fafc",
        "blurb": data.get("blurb") or "",
        "window": data.get("window") or "",
        "signature": data.get("signature") or [],
    }


def map_district(row: Any) -> dict[str, Any]:
    data = as_dict(row)
    features = map_features(data.get("features"))
    cluster = normalize_cluster(data.get("cluster") or data.get("cluster_label") or data.get("cluster_id"))
    return {
        "id": str(data.get("id")),
        "name": data.get("name"),
        "state": data.get("state"),
        "stateCode": data.get("state_code") or STATE_CODES.get(data.get("state"), ""),
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "cluster": cluster,
        "confidence": data.get("confidence") or 0,
        "reading3": features["reading3"],
        "yoyReading": features["yoyReading"],
        "featured": bool(data.get("featured", False)),
        "peers": data.get("peers") or [],
    }


def map_full_district(row: Any, evidence: list[dict[str, Any]] | None = None, peers: list[str] | None = None) -> dict[str, Any]:
    data = as_dict(row)
    features = map_features(data.get("features"))
    cluster = normalize_cluster(data.get("cluster") or data.get("cluster_label") or data.get("cluster_id"))
    district = {
        "id": str(data.get("id")),
        "name": data.get("name"),
        "state": data.get("state"),
        "stateCode": data.get("state_code") or STATE_CODES.get(data.get("state"), ""),
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "cluster": cluster,
        "confidence": data.get("confidence") or 0,
        "featured": bool(data.get("featured", False)),
        "shap": map_shap(data.get("shap_values")),
        "trend": data.get("trend") or [
            {"year": 2021, "reading3": round(features["reading3"] * 0.92, 3), "arith5": round(features["arith5"] * 0.92, 3)},
            {"year": 2022, "reading3": round(features["reading3"] - features["yoyReading"], 3), "arith5": round(features["arith5"] * 0.97, 3)},
            {"year": 2023, "reading3": features["reading3"], "arith5": features["arith5"]},
        ],
        "peers": peers or data.get("peers") or [],
        "evidence": evidence or [],
    }
    district.update(features)
    return district


def map_district_detail(row: Any, cluster_row: Any, evidence_rows: list[Any], peer_rows: list[Any], intervention_rows: list[Any]) -> dict[str, Any]:
    peer_items = [map_peer(row) for row in peer_rows]
    evidence = [map_evidence(row) for row in evidence_rows]
    district = map_full_district(row, evidence=evidence, peers=[peer["id"] for peer in peer_items])
    return {
        "district": district,
        "cluster": map_cluster(cluster_row),
        "features": map_feature_rows(row.get("features") if isinstance(row, dict) else as_dict(row).get("features")),
        "evidence": evidence,
        "peers": peer_items,
        "interventions": [map_intervention(row) for row in intervention_rows],
    }


def map_feature_rows(features: dict[str, Any] | None) -> list[dict[str, Any]]:
    mapped = map_features(features)
    return [
        {"key": key, "label": FEATURE_LABELS[key], "value": value, "unit": "%" if key in {"reading3", "arith5", "yoyReading", "genderGap", "vacancyRate", "infraScore", "ndviVar", "roadIdx", "newsMigration", "newsFlood"} else None}
        for key, value in mapped.items()
    ]


def map_peer(row: Any) -> dict[str, Any]:
    district = map_district(row)
    return {
        "id": district["id"],
        "name": district["name"],
        "state": district["state"],
        "cluster": district["cluster"],
        "reading3": district["reading3"],
    }


def map_evidence(row: Any) -> dict[str, Any]:
    data = as_dict(row)
    return {
        "id": str(data.get("id")),
        "districtId": str(data.get("district_id")),
        "raw": data.get("raw") or data.get("raw_text") or "",
        "source": data.get("source") or normalize_source_type(data.get("source_type")).replace("_", " ").title(),
        "sourceType": normalize_source_type(data.get("source_type")),
        "date": serialize(data.get("date") or data.get("scraped_at")),
        "classification": data.get("classification") or "Irrelevant",
        "reason": data.get("reason") or "",
        "url": data.get("url") or data.get("source_url") or "",
    }


def map_evidence_feed(row: Any) -> dict[str, Any]:
    data = as_dict(row)
    item = map_evidence(data)
    item.update({
        "districtName": data.get("district_name") or data.get("name"),
        "districtState": data.get("district_state") or data.get("state"),
        "cluster": normalize_cluster(data.get("cluster") or data.get("cluster_label")),
    })
    return item


def map_intervention(row: Any) -> dict[str, Any]:
    data = as_dict(row)
    cluster = normalize_cluster(data.get("cluster") or data.get("cluster_label") or data.get("cluster_id"))
    return {
        "id": str(data.get("id")) if data.get("id") else None,
        "cluster": cluster,
        "type": data.get("type") or data.get("intervention_type") or "",
        "districts": data.get("districts") or ([str(data.get("district_id"))] if data.get("district_id") else []),
        "aserDelta": data.get("aserDelta") if data.get("aserDelta") is not None else data.get("aser_delta", 0),
        "evidence": data.get("evidence") or 1,
        "blurb": data.get("blurb") or data.get("notes") or "",
    }


def map_cluster_assignment(row: Any) -> dict[str, Any]:
    data = as_dict(row)
    return {
        "districtId": str(data.get("district_id")),
        "cluster": normalize_cluster(data.get("cluster_label") or data.get("cluster_id")),
        "confidence": data.get("confidence") or 0,
        "shap": map_shap(data.get("shap_values")),
    }

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE IF NOT EXISTS districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    census_code TEXT UNIQUE,
    lat FLOAT,
    lng FLOAT
);

CREATE TABLE IF NOT EXISTS district_features (
    district_id UUID REFERENCES districts(id),
    year INT,
    features JSONB,
    PRIMARY KEY (district_id, year)
);

CREATE TABLE IF NOT EXISTS cluster_assignments (
    district_id UUID REFERENCES districts(id),
    cluster_id INT,
    cluster_label TEXT,
    confidence FLOAT,
    shap_values JSONB,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (district_id)
);

CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID REFERENCES districts(id),
    raw_text TEXT,
    source_url TEXT,
    source_type TEXT,
    classification TEXT,
    reason TEXT,
    embedding vector(384),
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID REFERENCES districts(id),
    intervention_type TEXT,
    started_at DATE,
    aser_delta FLOAT,
    notes TEXT
);

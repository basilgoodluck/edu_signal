FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ML stack needs gcc, g++, and OpenMP for hdbscan/umap compilation
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        g++ \
        libgomp1 \
        libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install heavy ML deps first (cached layer unless requirements change)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        numpy \
        pandas \
        scikit-learn \
        umap-learn \
        hdbscan \
        shap

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY scrapers/ /app/scrapers/

WORKDIR /app/backend

# One-shot: trains the clustering model and writes results to the DB.
# Triggered manually or via a scheduled job — not a long-running server.
CMD ["python", "-m", "ml.train"]

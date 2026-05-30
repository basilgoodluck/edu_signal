# EduSignal Backend Deployment

This guide deploys only the backend services to Azure Container Apps. The frontend is deployed separately on Vercel.

## Services

- API: FastAPI app from `backend/main.py`, exposed publicly over HTTPS.
- Worker: Celery worker from `backend/tasks/scrape_jobs.py`, internal only with no public ingress.
- Database: Azure Database for PostgreSQL, provisioned separately, with `pgvector` enabled.
- Redis: Azure Cache for Redis, provisioned separately, used for Celery broker/result backend and SSE pub/sub.
- Scrapers: Python package in `scrapers/`, included in the worker image.

## Required Environment Variables

- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string.
- `BRIGHTDATA_API_KEY`: Bright Data API key for scraper calls.
- `BRIGHTDATA_ZONE`: Bright Data zone, defaults to `serp_api3`.
- `GEMINI_API_KEY`: Gemini API key for evidence classification and AI chat.
- `FRONTEND_ORIGIN`: Comma-separated list of allowed frontend origins for CORS, for example `https://your-app.vercel.app`.

## Prerequisites

- Azure CLI with the Container Apps extension.
- Docker.
- An Azure subscription.
- GitHub repository secrets permission.

```bash
az extension add --name containerapp --upgrade
az login
```

## Create Azure Resources

Set names once:

```bash
RESOURCE_GROUP=edusignal-prod-rg
LOCATION=eastus
ACR_NAME=edusignalprodacr
ACA_ENV=edusignal-prod-env
API_APP=edusignal-api
WORKER_APP=edusignal-worker
```

Create the resource group and Azure Container Registry:

```bash
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
az acr create --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" --sku Basic --admin-enabled true
```

## Provision Postgres and Redis Separately

Create Azure Database for PostgreSQL Flexible Server using PostgreSQL 16 or another version that supports `pgvector`.

After creating the database, connect as an admin and enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Apply the schema from `backend/db/schema.sql`, then seed or migrate data as needed.

Create Azure Cache for Redis, then build `REDIS_URL` from its hostname and access key:

```text
rediss://:<redis-access-key>@<redis-hostname>:6380/0
```

Build `DATABASE_URL` from your PostgreSQL server values:

```text
postgresql://<user>:<password>@<postgres-hostname>:5432/<database>?sslmode=require
```

## Build and Push Initial Images

```bash
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)
az acr login --name "$ACR_NAME"

docker build -f backend/Dockerfile.api -t "$ACR_LOGIN_SERVER/edusignal-api:initial" .
docker build -f backend/Dockerfile.worker -t "$ACR_LOGIN_SERVER/edusignal-worker:initial" .

docker push "$ACR_LOGIN_SERVER/edusignal-api:initial"
docker push "$ACR_LOGIN_SERVER/edusignal-worker:initial"
```

## Deploy Container Apps

Get ACR credentials:

```bash
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query 'passwords[0].value' --output tsv)
```

Deploy the Bicep template. Replace placeholder secrets before running:

```bash
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/azure-container-apps.bicep \
  --parameters \
    location="$LOCATION" \
    containerAppsEnvironmentName="$ACA_ENV" \
    apiContainerAppName="$API_APP" \
    workerContainerAppName="$WORKER_APP" \
    acrLoginServer="$ACR_LOGIN_SERVER" \
    acrUsername="$ACR_USERNAME" \
    acrPassword="$ACR_PASSWORD" \
    apiImage="$ACR_LOGIN_SERVER/edusignal-api:initial" \
    workerImage="$ACR_LOGIN_SERVER/edusignal-worker:initial" \
    databaseUrl="<DATABASE_URL>" \
    redisUrl="<REDIS_URL>" \
    brightdataApiKey="<BRIGHTDATA_API_KEY>" \
    brightdataZone="serp_api3" \
    geminiApiKey="<GEMINI_API_KEY>" \
    frontendOrigin="https://your-app.vercel.app"
```

Print the public API URL:

```bash
az containerapp show \
  --name "$API_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

Use the result as:

```text
https://<container-app-fqdn>
```

Paste that URL into Vercel as `VITE_API_BASE_URL`.

## GitHub Actions CI/CD

Add these GitHub repository secrets:

- `AZURE_CREDENTIALS`: JSON credentials from an Azure service principal.
- `AZURE_RESOURCE_GROUP`: Resource group containing the Container Apps.
- `ACR_NAME`: Azure Container Registry name.
- `ACR_LOGIN_SERVER`: Registry login server, for example `edusignalprodacr.azurecr.io`.
- `API_CONTAINER_APP_NAME`: API Container App name.
- `WORKER_CONTAINER_APP_NAME`: Worker Container App name.

Create the service principal:

```bash
SUBSCRIPTION_ID=$(az account show --query id --output tsv)

az ad sp create-for-rbac \
  --name edusignal-github-deploy \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --sdk-auth
```

Store the JSON output as `AZURE_CREDENTIALS`.

Push to `main`. The workflow builds and pushes both images to ACR, updates the API and worker Container Apps, then prints the public API URL.

## Local Development With Docker Compose

Create a local env file if you need real scraper calls:

```bash
cp backend/.env.example backend/.env
```

Then run:

```bash
docker compose up --build
```

The API is available at `http://localhost:8000`, Postgres at `localhost:5434`, and Redis at `localhost:6381`.

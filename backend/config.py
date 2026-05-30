import os
from dotenv import load_dotenv

load_dotenv()

def split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


DATABASE_URL = os.environ["DATABASE_URL"]
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
BRIGHTDATA_API_KEY = os.environ["BRIGHTDATA_API_KEY"]
BRIGHTDATA_ZONE = os.environ.get("BRIGHTDATA_ZONE", "serp_api3")
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "")
ALLOWED_ORIGINS = split_csv(FRONTEND_ORIGIN) or ["*"]

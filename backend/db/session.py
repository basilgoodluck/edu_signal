import os
import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]

_pool = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL)
    return _pool


async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        with open("db/schema.sql") as f:
            await conn.execute(f.read())

import aiomysql
import os
from typing import Optional
from contextlib import asynccontextmanager

MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "education_admin")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "education")


class Database:
    _pool: Optional[aiomysql.Pool] = None

    @classmethod
    async def get_pool(cls) -> aiomysql.Pool:
        if cls._pool is None:
            cls._pool = await aiomysql.create_pool(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                db=MYSQL_DATABASE,
                autocommit=True,
                minsize=1,
                maxsize=10,
            )
        return cls._pool

    @classmethod
    async def close(cls):
        if cls._pool:
            cls._pool.close()
            await cls._pool.wait_closed()
            cls._pool = None

    @classmethod
    @asynccontextmanager
    async def get_db(cls):
        pool = await cls.get_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                try:
                    yield cur
                finally:
                    await conn.ensure_closed()


# FastAPI dependency for database
async def get_db():
    async with Database.get_db() as db:
        yield db


async def init_db():
    async with Database.get_db() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS child_profile (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL DEFAULT '',
                age INT DEFAULT 6,
                username VARCHAR(100) UNIQUE,
                password_hash VARCHAR(255),
                current_zone VARCHAR(100) DEFAULT 'number_meadow',
                current_level INT DEFAULT 1,
                crystals INT DEFAULT 0,
                streak_days INT DEFAULT 0,
                last_session_date VARCHAR(100),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
""")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS dudu_state (
                id INT AUTO_INCREMENT PRIMARY KEY,
                mood VARCHAR(50) DEFAULT 'happy',
                friendship_level INT DEFAULT 1,
                accessories TEXT,
                house_decorations TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS memory_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_type VARCHAR(100) NOT NULL,
                event_data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS session_records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date VARCHAR(100) NOT NULL,
                zone VARCHAR(100),
                problems_attempted INT DEFAULT 0,
                problems_correct INT DEFAULT 0,
                difficult_topics TEXT,
                dudu_dialogue_snapshot TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS math_levels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                topic VARCHAR(100) NOT NULL UNIQUE,
                level INT DEFAULT 1,
                total_attempts INT DEFAULT 0,
                total_correct INT DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS wrong_answers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                topic VARCHAR(100),
                question TEXT,
                correct_answer VARCHAR(255),
                child_answer VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS auth_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                token VARCHAR(64) UNIQUE NOT NULL,
                profile_id INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # 迁移：为已有表添加新字段（忽略已存在错误）
        for col_sql in [
            "ALTER TABLE child_profile ADD COLUMN username VARCHAR(100) UNIQUE",
            "ALTER TABLE child_profile ADD COLUMN password_hash VARCHAR(255)",
        ]:
            try:
                await db.execute(col_sql)
            except Exception:
                pass  # 字段可能已存在
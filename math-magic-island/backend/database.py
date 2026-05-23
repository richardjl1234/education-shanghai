import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "math_magic_island.db")


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS child_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT '',
                age INTEGER DEFAULT 6,
                current_zone TEXT DEFAULT 'number_meadow',
                current_level INTEGER DEFAULT 1,
                crystals INTEGER DEFAULT 0,
                streak_days INTEGER DEFAULT 0,
                last_session_date TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS dudu_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mood TEXT DEFAULT 'happy',
                friendship_level INTEGER DEFAULT 1,
                accessories TEXT DEFAULT '[]',
                house_decorations TEXT DEFAULT '[]',
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS memory_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                event_data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS session_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                zone TEXT,
                problems_attempted INTEGER DEFAULT 0,
                problems_correct INTEGER DEFAULT 0,
                difficult_topics TEXT DEFAULT '[]',
                dudu_dialogue_snapshot TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS math_levels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic TEXT NOT NULL UNIQUE,
                level INTEGER DEFAULT 1,
                total_attempts INTEGER DEFAULT 0,
                total_correct INTEGER DEFAULT 0,
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS wrong_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic TEXT,
                question TEXT,
                correct_answer TEXT,
                child_answer TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
        """)
        await db.commit()

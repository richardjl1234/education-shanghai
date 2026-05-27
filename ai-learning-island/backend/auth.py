import hashlib
import secrets
from fastapi import Header, HTTPException
from database import Database


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def generate_token() -> str:
    return secrets.token_hex(32)


async def get_current_user(authorization: str = Header("")) -> dict:
    """FastAPI Dependency: 从 Authorization Header 解析 token 并返回当前用户"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")

    token = authorization[7:]

    async with Database.get_db() as db:
        await db.execute(
            "SELECT profile_id FROM auth_tokens WHERE token=%s", (token,)
        )
        row = await db.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="token 无效或已过期")

        profile_id = row["profile_id"]
        await db.execute("SELECT * FROM child_profile WHERE id=%s", (profile_id,))
        profile = await db.fetchone()
        if not profile:
            raise HTTPException(status_code=401, detail="用户不存在")

        return dict(profile)

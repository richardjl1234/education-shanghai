from fastapi import FastAPI, Depends, Header, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, FileResponse, Response
import aiomysql
import json
import os
import random
from pathlib import Path
import glob

from database import Database, init_db, get_db
from models import ChildProfile, LoginRequest, RegisterRequest, DialogueRequest, DialogueResponse
from dialogue_engine import generate_dialogue
from tts_service import generate_speech, is_available as tts_available, CACHE_DIR as TTS_CACHE_DIR
from auth import hash_password, verify_password, generate_token, get_current_user

app = FastAPI(title="数学魔法岛 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()

    async with Database.get_db() as db:
        await db.execute("SELECT 1 FROM dudu_state LIMIT 1")
        dudu_exists = await db.fetchone()
        if not dudu_exists:
            await db.execute("INSERT INTO dudu_state (mood, friendship_level) VALUES ('happy', 1)")

        topics = ["数感", "加法", "减法", "图形", "钟表", "代数思维", "凑十法", "破十法"]
        for t in topics:
            await db.execute("INSERT IGNORE INTO math_levels (topic, level) VALUES (%s, 1)", (t,))


# ===== 认证系统 =====

@app.post("/api/auth/register")
async def register(data: RegisterRequest):
    """注册新用户 → 返回 token + profile"""
    async with Database.get_db() as db:
        # 检查用户名是否已存在
        await db.execute("SELECT id FROM child_profile WHERE username=%s", (data.username,))
        if await db.fetchone():
            return JSONResponse(status_code=409, content={"error": "用户名已存在"})

        # 创建用户
        pw_hash = hash_password(data.password)
        await db.execute(
            "INSERT INTO child_profile (name, username, password_hash, age) VALUES (%s, %s, %s, %s)",
            (data.name, data.username, pw_hash, data.age),
        )
        profile_id = db.lastrowid

        # 生成 token
        token = generate_token()
        await db.execute(
            "INSERT INTO auth_tokens (token, profile_id) VALUES (%s, %s)",
            (token, profile_id),
        )
        await db.execute("COMMIT")

    return {"token": token, "profile": {"id": profile_id, "name": data.name, "username": data.username, "age": data.age}}


@app.post("/api/auth/login")
async def login(data: LoginRequest):
    """登录 → 返回 token + profile"""
    async with Database.get_db() as db:
        await db.execute("SELECT * FROM child_profile WHERE username=%s", (data.username,))
        profile = await db.fetchone()
        if not profile or not verify_password(data.password, profile["password_hash"]):
            return JSONResponse(status_code=401, content={"error": "用户名或密码错误"})

        token = generate_token()
        await db.execute(
            "INSERT INTO auth_tokens (token, profile_id) VALUES (%s, %s)",
            (token, profile["id"]),
        )
        await db.execute("COMMIT")

    return {"token": token, "profile": {k: v for k, v in dict(profile).items() if k != "password_hash"}}


@app.post("/api/auth/logout")
async def logout(current_user: dict = Depends(get_current_user), authorization: str = Header("")):
    """登出：删除当前 token"""
    token = authorization[7:] if authorization.startswith("Bearer ") else ""
    async with Database.get_db() as db:
        await db.execute("DELETE FROM auth_tokens WHERE token=%s", (token,))
        await db.execute("COMMIT")
    return {"status": "ok"}


@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前用户信息"""
    return {k: v for k, v in current_user.items() if k != "password_hash"}


@app.post("/api/auth/change-password")
async def change_password(old_password: str, new_password: str, current_user: dict = Depends(get_current_user)):
    """修改密码"""
    if not verify_password(old_password, current_user["password_hash"]):
        return JSONResponse(status_code=400, content={"error": "原密码错误"})

    pw_hash = hash_password(new_password)
    async with Database.get_db() as db:
        await db.execute("UPDATE child_profile SET password_hash=%s WHERE id=%s",
                         (pw_hash, current_user["id"]))
        await db.execute("COMMIT")
    return {"status": "ok"}


# ===== 孩子档案 =====

@app.get("/api/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "password_hash"}


@app.post("/api/profile")
async def update_profile(data: ChildProfile, current_user: dict = Depends(get_current_user)):
    async with Database.get_db() as db:
        await db.execute(
            """UPDATE child_profile SET name=%s, age=%s, current_zone=%s, current_level=%s,
               crystals=%s, streak_days=%s, last_session_date=%s WHERE id=%s""",
            (data.name, data.age, data.current_zone, data.current_level,
             data.crystals, data.streak_days, data.last_session_date, current_user["id"]),
        )
        await db.execute("COMMIT")
    return {"status": "ok"}


# ===== 模块系统（v2.0 松耦合）=====

MODULES_DIR = Path(__file__).parent.parent / "modules"

# 模块ID → 中文知识主题 映射
MODULE_TOPIC_MAP = {
    "number_sense": "数感",
    "addition": "加法",
    "subtraction": "减法",
    "ten_complement": "凑十法",
    "borrowing_sub": "破十法",
    "clock_time": "钟表",
}

# 路线英文ID → 中文名
ROUTE_NAMES = {
    "sprout": "🌱 萌芽森林",
    "valley": "🧭 智慧山谷",
    "star": "🔮 星辰原野",
    "castle": "🏰 几何城堡",
    "dragon": "🐉 挑战龙穴",
}

# 题目池：静态模板 + 动态生成器
# 静态模板（答案固定，无需计算）
STATIC_PROBLEMS = {
    "数感": [
        {"q": "数一数：★ ★ ★ ★ 一共有几个星星？", "a": 4, "opts": [2, 3, 4, 5]},
        {"q": "比大小：8 和 3，哪个更大？", "a": 8, "opts": [2, 3, 5, 8]},
        {"q": "从1数到5，第3个数是几？", "a": 3, "opts": [2, 3, 4, 5]},
    ],
    "图形": [
        {"q": "下面哪个是三角形？", "a": 1, "opts": ["△", "○", "□", "☆"]},
        {"q": "一个正方形有几条边？", "a": 4, "opts": [3, 4, 5, 6]},
    ],
    "钟表": [
        {"q": "整点的时候，分针指向几？", "a": 12, "opts": [6, 12, 1, 3]},
    ],
    "破十法": [
        {"q": "15 - 8 = ? 用破十法怎么算？", "a": 7, "opts": [5, 6, 7, 8]},
        {"q": "13 - 6 = ?", "a": 7, "opts": [5, 6, 7, 8]},
        {"q": "16 - 9 = ?", "a": 7, "opts": [6, 7, 8, 9]},
    ],
}

# 需要动态计算的题目（题面随机生成，答案同步计算）
DYNAMIC_GENERATORS = {
    "加法": lambda: _gen_add(),
    "减法": lambda: _gen_sub(),
    "代数思维": lambda: _gen_algebra(),
    "凑十法": lambda: _gen_ten_complement(),
}


def _gen_options(correct, count=4):
    """生成包含正确答案的选项列表"""
    if isinstance(correct, str):
        return [correct]
    options = {correct}
    attempts = 0
    while len(options) < count and attempts < 50:
        delta = random.choice([-3, -2, -1, 1, 2, 3])
        distractor = correct + delta
        if distractor >= 0 and distractor not in options:
            options.add(distractor)
        attempts += 1
    while len(options) < count:
        options.add(correct + len(options) + 1)
    return sorted(random.sample(list(options), count))


def _gen_add():
    """生成加法题并计算正确答案"""
    a = random.randint(3, 9)
    b = random.randint(2, 6)
    answer = a + b
    q = random.choice([
        f"{a} + {b} = ?",
        f"树上有{a}只鸟，又飞来了{b}只，一共有几只？",
    ])
    return {"q": q, "a": answer, "opts": _gen_options(answer)}


def _gen_sub():
    """生成减法题并计算正确答案"""
    a = random.randint(6, 12)
    b = random.randint(2, min(5, a - 1))
    answer = a - b
    q = random.choice([
        f"{a} - {b} = ?",
        f"嘟嘟有{a}颗糖，吃了{b}颗，还剩几颗？",
    ])
    return {"q": q, "a": answer, "opts": _gen_options(answer)}


def _gen_algebra():
    """生成代数思维题并计算正确答案"""
    pattern = random.choice(["missing_addend", "missing_start"])
    if pattern == "missing_addend":
        a = random.randint(3, 7)
        total = random.randint(a + 2, a + 7)
        answer = total - a
        q = f"□ + {a} = {total}，□ = ?"
    else:
        known = random.randint(2, 8)
        total = random.randint(known + 2, known + 8)
        answer = total - known
        q = f"{known} + □ = {total}，□ = ?"
    return {"q": q, "a": answer, "opts": _gen_options(answer)}


def _gen_ten_complement():
    """生成凑十法题目——动态生成，包含数位拆分和动画参数"""
    # 两个难度级别：70% Level 1（凑10），30% Level 2（凑20）
    level = 1 if random.random() < 0.7 else 2
    if level == 1:
        # Level 1: a=7-9，凑10
        a = random.randint(7, 9)
        target = 10
        min_b = target - a + 1
        b = random.randint(min_b, min(min_b + 3, 9))
    else:
        # Level 2: a=11-17，凑20
        a = random.randint(11, 17)
        target = 20
        min_b = target - a + 1
        b = random.randint(min_b, min(min_b + 3, 8))

    a_tens = a // 10         # 十位个数
    a_ones = a % 10          # 个位数
    split_first = target - a   # 需要凑到整十的数
    split_second = b - split_first  # 剩余部分
    answer = a + b

    q = f"{a} + {b} = ?"
    steps = [
        f"{a} + {b} = ？",
        f"把{b}分成{split_first}和{split_second}，先凑{target}",
        f"{a} + {split_first} = {target}，{target} + {split_second} = {answer}！",
    ]
    animation_url = f"/animation/make-ten.html?a={a}&b={b}&answer={answer}"

    return {
        "q": q,
        "a": answer,
        "opts": _gen_options(answer),
        "topic": "凑十法",
        "a_val": a,
        "b_val": b,
        "a_tens": a_tens,
        "a_ones": a_ones,
        "target": target,
        "split_first": split_first,
        "split_second": split_second,
        "steps": steps,
        "animation_url": animation_url,
    }


def generate_problems(topic, count=3):
    """生成一组验证通过的题目"""
    # 优先使用静态模板
    if topic in STATIC_PROBLEMS:
        pool = STATIC_PROBLEMS[topic]
        selected = random.sample(pool, min(count, len(pool)))
        return [dict(p) for p in selected]

    # 动态生成并计算答案
    generator = DYNAMIC_GENERATORS.get(topic)
    if not generator:
        return []

    problems = []
    for _ in range(count):
        prob = generator()
        # 验证：正确答案必须在选项中
        if prob["a"] not in prob["opts"]:
            prob["opts"] = _gen_options(prob["a"])
        problems.append(prob)
    return problems


@app.get("/api/modules")
async def get_modules():
    """获取所有模块配置（路线图数据）"""
    modules = []
    if not MODULES_DIR.exists():
        return []

    for module_dir in MODULES_DIR.iterdir():
        if not module_dir.is_dir():
            continue
        config_file = module_dir / "config.json"
        if not config_file.exists():
            continue

        with open(config_file) as f:
            config = json.load(f)

        # 添加路由标志，表示可用
        config["available"] = config.get("status") == "ready"
        # 映射中文topic名
        config["topic"] = MODULE_TOPIC_MAP.get(config["id"])

        modules.append(config)

    # 按路线和顺序排序
    modules.sort(key=lambda m: (m.get("route", ""), m.get("order", 0)))
    return modules


@app.get("/api/modules/{module_id}")
async def get_module(module_id: str):
    """获取单个模块详情"""
    config_file = MODULES_DIR / module_id / "config.json"
    if not config_file.exists():
        return JSONResponse(status_code=404, content={"error": "模块不存在"})

    with open(config_file) as f:
        return json.load(f)


@app.get("/api/challenge/{module_id}")
async def get_module_challenge(module_id: str):
    """为模块生成一组答题题目"""
    config_file = MODULES_DIR / module_id / "config.json"
    if not config_file.exists():
        return JSONResponse(status_code=404, content={"error": "模块不存在"})

    with open(config_file) as f:
        config = json.load(f)

    if config.get("status") != "ready":
        return JSONResponse(status_code=400, content={"error": "模块未就绪"})

    topic = MODULE_TOPIC_MAP.get(module_id)
    if not topic:
        return JSONResponse(status_code=400, content={"error": "模块无对应题目"})

    problems = generate_problems(topic, count=3)
    if not problems:
        return JSONResponse(status_code=500, content={"error": "题目生成失败"})

    return {"module_id": module_id, "name": config["name"], "topic": topic, "problems": problems}


# ===== 嘟嘟状态 =====

@app.get("/api/dudu")
async def get_dudu():
    async with Database.get_db() as db:
        await db.execute("SELECT * FROM dudu_state LIMIT 1")
        state = await db.fetchone()
        if state:
            d = dict(state)
            d["accessories"] = json.loads(d.get("accessories") or "[]")
            d["house_decorations"] = json.loads(d.get("house_decorations") or "[]")
            return d
        return {}


@app.post("/api/dudu/mood")
async def set_dudu_mood(mood: str):
    async with Database.get_db() as db:
        await db.execute("UPDATE dudu_state SET mood=%s WHERE id=1", (mood,))
        await db.execute("COMMIT")
    return {"status": "ok"}


# ===== 对话生成 =====

@app.post("/api/dialogue", response_model=DialogueResponse)
async def get_dialogue(req: DialogueRequest):
    async with Database.get_db() as db:
        await db.execute(
            "SELECT event_data FROM memory_events ORDER BY created_at DESC LIMIT 5"
        )
        memory_rows = await db.fetchall()
        memories = [json.loads(r["event_data"]) for r in memory_rows]

        await db.execute(
            "SELECT difficult_topics FROM session_records ORDER BY date DESC LIMIT 1"
        )
        last_record = await db.fetchone()

        result = generate_dialogue(
            scene=req.scene,
            child_name=req.child_name,
            memory_events=memories,
            topic=req.topic,
            problem=req.problem,
            is_correct=req.is_correct,
            streak=req.streak,
            zone=req.zone,
        )

        await db.execute("UPDATE dudu_state SET mood=%s WHERE id=1", (result["mood"],))
        await db.execute("COMMIT")

    return DialogueResponse(
        text=result["text"],
        mood=result["mood"],
        animation=result["animation"],
    )


# ===== TTS 语音 =====

@app.get("/api/tts")
async def text_to_speech(text: str = Query(..., min_length=1)):
    if not tts_available():
        return JSONResponse(status_code=503, content={"error": "TTS not configured"})

    audio_data = generate_speech(text)
    if audio_data is None:
        return JSONResponse(status_code=500, content={"error": "TTS generation failed"})

    return Response(content=audio_data, media_type="audio/mpeg")


# ===== 记忆系统 =====

@app.get("/api/memories")
async def get_memories(limit: int = 10):
    async with Database.get_db() as db:
        await db.execute(
            "SELECT * FROM memory_events ORDER BY created_at DESC LIMIT %s", (limit,)
        )
        rows = await db.fetchall()
    return [dict(r) for r in rows]


@app.post("/api/memories")
async def add_memory(event_type: str, event_data: dict):
    async with Database.get_db() as db:
        await db.execute(
            "INSERT INTO memory_events (event_type, event_data) VALUES (%s, %s)",
            (event_type, json.dumps(event_data, ensure_ascii=False)),
        )
        await db.execute("COMMIT")
    return {"status": "ok"}


# ===== 学习记录 =====

@app.get("/api/sessions")
async def get_sessions(limit: int = 10):
    async with Database.get_db() as db:
        await db.execute(
            "SELECT * FROM session_records ORDER BY date DESC LIMIT %s", (limit,)
        )
        rows = await db.fetchall()
    return [dict(r) for r in rows]


@app.post("/api/sessions")
async def save_session(
    zone: str,
    problems_attempted: int,
    problems_correct: int,
    difficult_topics: str = "[]",
    dudu_snapshot: str = "",
):
    from datetime import date
    async with Database.get_db() as db:
        await db.execute(
            """INSERT INTO session_records (date, zone, problems_attempted, problems_correct,
               difficult_topics, dudu_dialogue_snapshot)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (str(date.today()), zone, problems_attempted, problems_correct,
             difficult_topics, dudu_snapshot),
        )
        await update_streak(db)
        await db.execute("COMMIT")
    return {"status": "ok"}


async def update_streak(db):
    from datetime import date, timedelta
    today = date.today()
    yesterday = today - timedelta(days=1)

    await db.execute("SELECT streak_days, last_session_date FROM child_profile WHERE id=1")
    profile = await db.fetchone()
    if not profile:
        return

    streak = profile.get("streak_days") or 0
    last_date = profile.get("last_session_date")

    if last_date == str(yesterday):
        streak += 1
    elif last_date != str(today):
        streak = 1

    await db.execute(
        "UPDATE child_profile SET streak_days=%s, last_session_date=%s WHERE id=1",
        (streak, str(today)),
    )


# ===== 数学能力 =====

@app.get("/api/math-levels")
async def get_math_levels():
    async with Database.get_db() as db:
        await db.execute("SELECT * FROM math_levels")
        rows = await db.fetchall()
    return [dict(r) for r in rows]


@app.post("/api/math-levels")
async def update_math_level(topic: str, correct: bool):
    async with Database.get_db() as db:
        await db.execute(
            "SELECT level, total_attempts, total_correct FROM math_levels WHERE topic=%s",
            (topic,),
        )
        level_data = await db.fetchone()
        if not level_data:
            return {"status": "not_found"}

        level = level_data.get("level")
        attempts = level_data.get("total_attempts") or 0
        corr = level_data.get("total_correct") or 0
        attempts += 1
        if correct:
            corr += 1

        if attempts >= 5 and corr / attempts >= 0.8 and level < 5:
            level += 1

        await db.execute(
            "UPDATE math_levels SET level=%s, total_attempts=%s, total_correct=%s WHERE topic=%s",
            (level, attempts, corr, topic),
        )
        await db.execute("COMMIT")
    return {"status": "ok", "level": level}


# ===== 错题本 =====

@app.get("/api/wrong-answers")
async def get_wrong_answers(limit: int = 20):
    async with Database.get_db() as db:
        await db.execute(
            "SELECT * FROM wrong_answers ORDER BY created_at DESC LIMIT %s", (limit,)
        )
        rows = await db.fetchall()
    return [dict(r) for r in rows]


@app.post("/api/wrong-answers")
async def add_wrong_answer(
    topic: str,
    question: str,
    correct_answer: str,
    child_answer: str,
):
    async with Database.get_db() as db:
        await db.execute(
            "INSERT INTO wrong_answers (topic, question, correct_answer, child_answer) VALUES (%s, %s, %s, %s)",
            (topic, question, correct_answer, child_answer),
        )
        await db.execute("COMMIT")
    return {"status": "ok"}


# ===== 学习洞察（L2记忆） =====

@app.get("/api/memories/learning-insights")
async def get_learning_insights():
    async with Database.get_db() as db:
        await db.execute(
            "SELECT topic, question, correct_answer, child_answer, created_at FROM wrong_answers "
            "ORDER BY created_at DESC LIMIT 20"
        )
        recent_error_rows = await db.fetchall()
        recent_errors = [{"topic": r["topic"], "question": r["question"], "correct": r["correct_answer"], "child": r["child_answer"]}
                         for r in recent_error_rows]

        from datetime import date, timedelta
        week_ago = date.today() - timedelta(days=7)
        await db.execute(
            "SELECT topic, COUNT(*) as cnt FROM wrong_answers "
            "WHERE created_at >= %s "
            "GROUP BY topic ORDER BY cnt DESC", (week_ago,)
        )
        topic_error_rows = await db.fetchall()
        topic_error_counts = {r["topic"]: r["cnt"] for r in topic_error_rows}

        repeat_topics = {t: c for t, c in topic_error_counts.items() if c >= 2}

        await db.execute(
            "SELECT zone, problems_attempted, problems_correct, date FROM session_records "
            "ORDER BY date DESC LIMIT 5"
        )
        session_rows = await db.fetchall()
        sessions = [dict(r) for r in session_rows]
        sessions.reverse()

        accuracy_trend = None
        if len(sessions) >= 3:
            first_acc = sessions[0]["problems_correct"] / max(1, sessions[0]["problems_attempted"])
            last_acc = sessions[-1]["problems_correct"] / max(1, sessions[-1]["problems_attempted"])
            if last_acc > first_acc + 0.1:
                accuracy_trend = "improving"
            elif last_acc < first_acc - 0.1:
                accuracy_trend = "declining"
            else:
                accuracy_trend = "stable"

        dudu_memories = []
        if recent_errors:
            worst_topic = max(topic_error_counts, key=topic_error_counts.get) if topic_error_counts else None
            if worst_topic:
                dudu_memories.append({
                    "type": "struggle_topic",
                    "topic": worst_topic,
                    "count": topic_error_counts[worst_topic],
                    "message": f"上次在{worst_topic}上卡住了{str(topic_error_counts[worst_topic])}次"
                })
        if accuracy_trend == "improving":
            dudu_memories.append({
                "type": "improving",
                "message": "最近进步很大！正确率在提高~"
            })
        elif accuracy_trend == "declining":
            dudu_memories.append({
                "type": "declining",
                "message": "最近有点难对吧？没关系，今天一起加油！"
            })

    return {
        "recent_errors": recent_errors[:10],
        "topic_error_counts": topic_error_counts,
        "repeat_topics": list(repeat_topics.keys()),
        "accuracy_trend": accuracy_trend,
        "sessions": sessions,
        "dudu_memories": dudu_memories,
    }


@app.get("/api/memories/similar-problem")
async def generate_similar_problem(
    topic: str = "加法",
    difficulty: int = Query(default=1, ge=1, le=5),
):
    async with Database.get_db() as db:
        await db.execute(
            "SELECT question, correct_answer FROM wrong_answers WHERE topic=%s "
            "ORDER BY created_at DESC LIMIT 3", (topic,)
        )
        ref_rows = await db.fetchall()
        refs = [{"question": r["question"], "answer": r["correct_answer"]} for r in ref_rows]

    problems = generate_problems(topic, count=1)
    if not problems:
        return JSONResponse(status_code=500, content={"error": "题目生成失败"})

    p = problems[0]
    return {
        "question": p["q"],
        "answer": p["a"],
        "options": p["opts"] if isinstance(p["opts"][0], int) else p["opts"],
        "topic": topic,
        "from_ref": len(refs) > 0,
    }


# ===== 装饰商店 =====

SHOP_ITEMS = [
    {"id": "wallpaper_stars", "name": "星空壁纸", "category": "wallpaper", "price": 5, "icon": "🌟", "description": "嘟嘟的蘑菇屋墙壁变成星空"},
    {"id": "wallpaper_rainbow", "name": "彩虹壁纸", "category": "wallpaper", "price": 8, "icon": "🌈"},
    {"id": "furniture_bed", "name": "小床", "category": "furniture", "price": 10, "icon": "🛏️"},
    {"id": "furniture_table", "name": "小桌子", "category": "furniture", "price": 8, "icon": "🪑"},
    {"id": "furniture_bookshelf", "name": "小书架", "category": "furniture", "price": 12, "icon": "📚"},
    {"id": "plant_flower", "name": "花花盆栽", "category": "plant", "price": 5, "icon": "🌻"},
    {"id": "plant_cactus", "name": "仙人掌", "category": "plant", "price": 6, "icon": "🌵"},
    {"id": "plant_mushroom", "name": "小蘑菇灯", "category": "plant", "price": 7, "icon": "🍄"},
    {"id": "accessory_hat", "name": "小帽子", "category": "accessory", "price": 15, "icon": "🎀", "description": "嘟嘟戴上可爱的蝴蝶结"},
    {"id": "accessory_glasses", "name": "小眼镜", "category": "accessory", "price": 12, "icon": "👓"},
    {"id": "accessory_scarf", "name": "小围巾", "category": "accessory", "price": 10, "icon": "🧣"},
    {"id": "pet_friend", "name": "小伙伴", "category": "pet", "price": 20, "icon": "🐰", "description": "来了一只小兔子陪嘟嘟玩"},
]

FRIENDSHIP_NAMES = {1: "初次见面", 2: "好朋友", 3: "亲密伙伴", 4: "最好的朋友", 5: "一家人的感觉"}

@app.get("/api/shop/items")
async def get_shop_items():
    async with Database.get_db() as db:
        await db.execute("SELECT house_decorations, accessories FROM dudu_state WHERE id=1")
        state = await db.fetchone()
        owned_decor = json.loads(state.get("house_decorations") or "[]") if state else []
        owned_acc = json.loads(state.get("accessories") or "[]") if state else []
        owned = owned_decor + owned_acc
    return [{"id": i["id"], "name": i["name"], "category": i["category"],
             "price": i["price"], "icon": i.get("icon",""), "owned": i["id"] in owned}
            for i in SHOP_ITEMS]

@app.post("/api/shop/buy")
async def buy_item(item_id: str):
    item = next((i for i in SHOP_ITEMS if i["id"] == item_id), None)
    if not item:
        return {"status": "not_found"}

    async with Database.get_db() as db:
        await db.execute("SELECT crystals FROM child_profile WHERE id=1")
        crystals_row = await db.fetchone()
        crystals = crystals_row["crystals"]
        if crystals < item["price"]:
            return {"status": "not_enough_crystals", "have": crystals, "need": item["price"]}

        await db.execute("SELECT house_decorations, accessories FROM dudu_state WHERE id=1")
        state = await db.fetchone()
        decor = json.loads(state.get("house_decorations") or "[]")
        acc = json.loads(state.get("accessories") or "[]")

        if item["category"] == "accessory":
            if item_id in acc: return {"status": "already_owned"}
            acc.append(item_id)
        else:
            if item_id in decor: return {"status": "already_owned"}
            decor.append(item_id)

        await db.execute("UPDATE dudu_state SET house_decorations=%s, accessories=%s WHERE id=1",
                         (json.dumps(decor, ensure_ascii=False), json.dumps(acc, ensure_ascii=False)))
        await db.execute("UPDATE child_profile SET crystals=crystals-%s WHERE id=1", (item["price"],))
        await db.execute("COMMIT")
    return {"status": "ok", "crystals_left": crystals - item["price"]}


# ===== 亲密度 =====

@app.get("/api/dudu/friendship")
async def get_friendship():
    async with Database.get_db() as db:
        await db.execute("SELECT friendship_level FROM dudu_state WHERE id=1")
        level_row = await db.fetchone()
        level = level_row["friendship_level"]
        await db.execute("SELECT COUNT(*) as cnt FROM session_records")
        total_row = await db.fetchone()
        total_sessions = total_row["cnt"]
    level_name = FRIENDSHIP_NAMES.get(level, "好朋友")
    next_level_at = level * 7
    progress = min(100, int((total_sessions % 7) / 7 * 100)) if level < 5 else 100
    return {"level": level, "name": level_name, "total_sessions": total_sessions,
            "next_level_at": next_level_at, "progress": progress}

@app.post("/api/dudu/friendship")
async def update_friendship():
    async with Database.get_db() as db:
        await db.execute("SELECT friendship_level FROM dudu_state WHERE id=1")
        level_row = await db.fetchone()
        level = level_row["friendship_level"]
        await db.execute("SELECT COUNT(*) as cnt FROM session_records")
        total_row = await db.fetchone()
        total = total_row["cnt"]
        new_level = min(5, 1 + total // 7)
        if new_level != level:
            await db.execute("UPDATE dudu_state SET friendship_level=%s WHERE id=1", (new_level,))
            await db.execute("COMMIT")
            return {"status": "leveled_up", "old_level": level, "new_level": new_level,
                    "name": FRIENDSHIP_NAMES.get(new_level, "")}
    return {"status": "ok", "level": level}


# ===== 家长报告 =====

@app.get("/api/report")
async def get_report():
    async with Database.get_db() as db:
        await db.execute(
            "SELECT COUNT(*) as total_sessions, SUM(problems_attempted) as total_problems, "
            "SUM(problems_correct) as total_correct FROM session_records")
        stats = await db.fetchone()

        await db.execute("SELECT topic, level, total_attempts, total_correct FROM math_levels")
        topic_rows = await db.fetchall()
        topics = []
        for r in topic_rows:
            acc = round(r["total_correct"] / r["total_attempts"] * 100) if r["total_attempts"] > 0 else 0
            topics.append({"topic": r["topic"], "level": r["level"], "accuracy": acc,
                           "attempts": r["total_attempts"], "correct": r["total_correct"]})

        from datetime import date, timedelta
        week_ago = date.today() - timedelta(days=7)
        await db.execute(
            "SELECT date, SUM(problems_correct) as c FROM session_records "
            "WHERE date >= %s GROUP BY date ORDER BY date", (week_ago,))
        daily_rows = await db.fetchall()
        daily = [{"date": r["date"], "correct": r["c"]} for r in daily_rows]

        await db.execute(
            "SELECT topic, COUNT(*) as cnt FROM wrong_answers GROUP BY topic ORDER BY cnt DESC LIMIT 5")
        weak_rows = await db.fetchall()
        weak = [{"topic": r["topic"], "count": r["cnt"]} for r in weak_rows]

        await db.execute("SELECT streak_days, crystals FROM child_profile WHERE id=1")
        p = await db.fetchone()

        await db.execute("SELECT friendship_level FROM dudu_state WHERE id=1")
        f = await db.fetchone()

    return {
        "total_sessions": stats["total_sessions"] or 0,
        "total_problems": stats["total_problems"] or 0,
        "total_correct": stats["total_correct"] or 0,
        "overall_accuracy": round(stats["total_correct"] / stats["total_problems"] * 100) if stats["total_problems"] else 0,
        "streak_days": p["streak_days"] or 0,
        "crystals": p["crystals"] or 0,
        "friendship_level": f["friendship_level"] or 1,
        "friendship_name": FRIENDSHIP_NAMES.get(f["friendship_level"] or 1, ""),
        "topics": topics,
        "daily_history": daily,
        "weak_topics": weak,
    }


# ===== 静态文件服务 =====

if TTS_CACHE_DIR.exists():
    app.mount("/tts_cache", StaticFiles(directory=str(TTS_CACHE_DIR)), name="tts_cache")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    @app.get("/{rest:path}")
    async def serve_frontend(rest: str = ""):
        """服务前端静态文件，作为API路由的后备"""
        target = FRONTEND_DIR / rest if rest else FRONTEND_DIR / "index.html"
        if target.is_file():
            return FileResponse(str(target))
        # SPA fallback: 所有未匹配路径返回index.html
        return FileResponse(str(FRONTEND_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
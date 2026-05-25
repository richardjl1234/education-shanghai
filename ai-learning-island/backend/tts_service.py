"""
嘟嘟 TTS 语音服务 — MiniMax API (Token Plan) 封装 + 本地缓存
"""

import hashlib
import os
from pathlib import Path
from typing import Optional

import httpx

# 环境变量配置（通过 education_config.sh 在运行前设置）
# 不读取 .env 文件，避免 API Key 泄露
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "")
MINIMAX_GROUP_ID = os.environ.get("MINIMAX_GROUP_ID", "")
TT_VOICE_ID = os.environ.get("TTS_VOICE_ID", "Chinese (Mandarin)_Cute_Spirit")

# MiniMax Token Plan API — 同步 TTS
MINIMAX_API_URL = "https://api.minimaxi.com/v1/t2a_v2"

# 本地缓存目录
CACHE_DIR = Path(__file__).parent / "tts_cache"
CACHE_DIR.mkdir(exist_ok=True)

# 短文本跳过 TTS（避免机械感）
MIN_TEXT_LENGTH = 4


def is_available() -> bool:
    """检查 TTS 是否可用（API Key + Group ID 已配置）"""
    return bool(MINIMAX_API_KEY) and bool(MINIMAX_GROUP_ID)


def _cache_path(text: str) -> Path:
    """根据文本哈希生成缓存文件路径"""
    h = hashlib.md5(text.encode("utf-8")).hexdigest()
    return CACHE_DIR / f"{h}.mp3"


def _skip_tts(text: str) -> bool:
    """判断是否跳过 TTS（太短或纯符号）"""
    if len(text) < MIN_TEXT_LENGTH:
        return True
    stripped = text.strip()
    if not stripped:
        return True
    return False


def generate_speech(text: str, voice_id: Optional[str] = None) -> Optional[bytes]:
    """
    生成语音音频
    返回 MP3 字节数据，失败返回 None
    """
    if not is_available():
        return None
    if _skip_tts(text):
        return None

    cache_path = _cache_path(text)
    if cache_path.exists():
        return cache_path.read_bytes()

    try:
        vid = voice_id or TT_VOICE_ID
        headers = {
            "Authorization": f"Bearer {MINIMAX_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "speech-2.8-hd",
            "text": text,
            "voice_setting": {
                "voice_id": vid,
                "speed": 1.1,
                "pitch": 3,
            },
            "audio_setting": {
                "format": "mp3",
                "sample_rate": 32000,
                "bitrate": 128000,
                "channel": 1,
            },
            "group_id": MINIMAX_GROUP_ID,
        }

        with httpx.Client(timeout=30) as client:
            resp = client.post(MINIMAX_API_URL, headers=headers, json=payload)
            resp.raise_for_status()

        data = resp.json()

        # 检查 API 返回的错误码
        base_resp = data.get("base_resp", {})
        status_code = base_resp.get("status_code", 0)
        if status_code != 0:
            print(f"[TTS] MiniMax API error: {base_resp.get('status_msg', 'unknown')}")
            return None

        # 提取 hex 编码的音频（speech-2.8-hd 默认返回 hex）
        audio_hex = data.get("data", {}).get("audio", "")
        if not audio_hex:
            return None

        audio_data = bytes.fromhex(audio_hex)
        if not audio_data:
            return None

        cache_path.write_bytes(audio_data)
        return audio_data

    except Exception as e:
        print(f"[TTS] MiniMax API error: {e}")
        return None

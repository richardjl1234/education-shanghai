from pydantic import BaseModel
from typing import Optional
from datetime import date


class ChildProfile(BaseModel):
    name: str = ""
    age: int = 6
    current_zone: str = "number_meadow"
    current_level: int = 1
    crystals: int = 0
    streak_days: int = 0
    last_session_date: Optional[str] = None


class DuduState(BaseModel):
    mood: str = "happy"
    friendship_level: int = 1
    accessories: list[str] = []
    house_decorations: list[str] = []


class SessionRecord(BaseModel):
    date: str
    zone: str
    problems_attempted: int = 0
    problems_correct: int = 0
    difficult_topics: list[str] = []
    dudu_dialogue_snapshot: str = ""


class MathLevel(BaseModel):
    topic: str
    level: int = 1
    total_attempts: int = 0
    total_correct: int = 0


class MemoryEvent(BaseModel):
    event_type: str
    event_data: dict


class Problem(BaseModel):
    question: str
    answer: int
    options: list[int]
    topic: str
    difficulty: int


class DialogueRequest(BaseModel):
    scene: str
    child_name: str = ""
    topic: Optional[str] = None
    problem: Optional[str] = None
    is_correct: Optional[bool] = None
    streak: Optional[int] = None
    zone: Optional[str] = None


class DialogueResponse(BaseModel):
    text: str
    mood: str
    animation: str = "idle"

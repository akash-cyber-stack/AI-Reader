"""
Local JSON storage when MongoDB is unavailable (desktop / dev mode).
"""

import asyncio
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DATA_FILE = DATA_DIR / "local_db.json"
_lock = asyncio.Lock()
VOICE_MODEL_VERSION = "wav-pcm-v1"


def _default_data() -> dict:
    return {"users": [], "voice_profiles": [], "command_logs": []}


async def _read() -> dict:
    async with _lock:
        if not DATA_FILE.exists():
            return _default_data()
        with open(DATA_FILE, "r", encoding="utf-8") as handle:
            return json.load(handle)


async def _write(data: dict) -> None:
    async with _lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, default=str)


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


async def count_users() -> int:
    data = await _read()
    return len(data["users"])


async def find_user_by_username(username: str) -> Optional[dict]:
    data = await _read()
    for user in data["users"]:
        if user.get("username") == username:
            return _user_to_doc(user)
    return None


async def find_user_by_id(user_id: str) -> Optional[dict]:
    data = await _read()
    for user in data["users"]:
        if str(user.get("id")) == str(user_id):
            return _user_to_doc(user)
    return None


async def list_users_public() -> list[dict]:
    data = await _read()
    result = []
    for user in data["users"]:
        result.append({
            "id": user.get("id"),
            "username": user.get("username"),
            "email": user.get("email"),
            "isOwner": user.get("isOwner", False),
            "createdAt": user.get("createdAt"),
        })
    return result


async def insert_user(user_doc: dict) -> dict:
    data = await _read()
    user_id = str(uuid.uuid4())
    stored = {
        "id": user_id,
        "username": user_doc["username"],
        "email": user_doc.get("email"),
        "passwordHash": user_doc["passwordHash"],
        "voiceProfileId": user_doc.get("voiceProfileId"),
        "isOwner": user_doc.get("isOwner", False),
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
    }
    data["users"].append(stored)
    await _write(data)
    return _user_to_doc(stored)


async def update_user(user_id: str, fields: dict) -> None:
    data = await _read()
    for user in data["users"]:
        if str(user.get("id")) == str(user_id):
            user.update(fields)
            user["updatedAt"] = _now_iso()
            break
    await _write(data)


def _user_to_doc(user: dict) -> dict:
    doc = dict(user)
    doc["_id"] = user.get("id")
    return doc


async def find_voice_profile(user_id: str) -> Optional[dict]:
    data = await _read()
    for profile in data["voice_profiles"]:
        if str(profile.get("userId")) == str(user_id):
            doc = dict(profile)
            doc["_id"] = profile.get("id")
            return doc
    return None


async def enroll_voice_sample(
    user_id: str,
    sample_number: int,
    phrase: str,
    embedding: list,
) -> dict:
    data = await _read()
    profiles = data["voice_profiles"]
    profile = next((p for p in profiles if str(p.get("userId")) == str(user_id)), None)

    if not profile:
        profile = {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "voiceEmbeddings": embedding,
            "enrollmentSamples": 1,
            "sampleHistory": [sample_number],
            "samplePhrases": [phrase],
            "voiceModelVersion": VOICE_MODEL_VERSION,
            "createdAt": _now_iso(),
            "updatedAt": _now_iso(),
        }
        profiles.append(profile)
        total_samples = 1
    else:
        sample_phrases = profile.get("samplePhrases", [])
        if sample_number == 1 and (
            len(sample_phrases) < 3
            or profile.get("voiceModelVersion") != VOICE_MODEL_VERSION
        ):
            embeddings: list = []
            sample_history: list = []
            sample_phrases = []
        else:
            embeddings = list(profile.get("voiceEmbeddings", []))
            sample_history = list(profile.get("sampleHistory", []))

        if sample_number in sample_history:
            sample_index = sample_history.index(sample_number)
            if sample_index < len(embeddings):
                embeddings[sample_index] = embedding[0]
            if sample_index < len(sample_phrases):
                sample_phrases[sample_index] = phrase
        else:
            embeddings.append(embedding[0])
            sample_history.append(sample_number)
            sample_phrases.append(phrase)

        total_samples = len(set(sample_history))
        profile["voiceEmbeddings"] = embeddings
        profile["sampleHistory"] = sample_history
        profile["samplePhrases"] = sample_phrases
        profile["enrollmentSamples"] = total_samples
        profile["voiceModelVersion"] = VOICE_MODEL_VERSION
        profile["updatedAt"] = _now_iso()

    await _write(data)
    await update_user(user_id, {"voiceProfileId": profile["id"]})

    return {
        "success": True,
        "totalSamples": profile.get("enrollmentSamples", 1),
        "enrolled": profile.get("enrollmentSamples", 0) >= 3,
    }


async def log_command(entry: dict) -> None:
    data = await _read()
    entry["id"] = str(uuid.uuid4())
    entry["timestamp"] = _now_iso()
    data["command_logs"].append(entry)
    await _write(data)

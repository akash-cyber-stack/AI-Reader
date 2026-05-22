"""
Unified storage: MongoDB when available, else local JSON file.
"""

from datetime import datetime
from typing import Any, Optional

from app.database.mongodb import get_db

VOICE_MODEL_VERSION = "wav-pcm-v1"


def mongo_available() -> bool:
    return get_db() is not None


async def count_users() -> int:
    db = get_db()
    if db is not None:
        return await db["users"].count_documents({})
    from app.database import local_store
    return await local_store.count_users()


async def find_user_by_username(username: str) -> Optional[dict]:
    db = get_db()
    if db is not None:
        return await db["users"].find_one({"username": username})
    from app.database import local_store
    return await local_store.find_user_by_username(username)


async def find_user_by_id(user_id: str) -> Optional[dict]:
    db = get_db()
    if db is not None:
        from bson import ObjectId
        try:
            return await db["users"].find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
    from app.database import local_store
    return await local_store.find_user_by_id(user_id)


async def list_users_public() -> list[dict]:
    db = get_db()
    if db is not None:
        users = []
        async for doc in db["users"].find({}, {"passwordHash": 0}):
            users.append({
                "id": str(doc["_id"]),
                "username": doc.get("username"),
                "email": doc.get("email"),
                "isOwner": doc.get("isOwner", False),
                "createdAt": doc.get("createdAt"),
            })
        return users
    from app.database import local_store
    return await local_store.list_users_public()


async def insert_user(user_doc: dict) -> dict:
    db = get_db()
    if db is not None:
        result = await db["users"].insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        return user_doc
    from app.database import local_store
    return await local_store.insert_user(user_doc)


async def update_user(user_id: str, fields: dict) -> None:
    db = get_db()
    if db is not None:
        from bson import ObjectId
        await db["users"].update_one({"_id": ObjectId(user_id)}, {"$set": fields})
        return
    from app.database import local_store
    await local_store.update_user(user_id, fields)


async def find_voice_profile(user_id: str) -> Optional[dict]:
    db = get_db()
    if db is not None:
        from bson import ObjectId
        return await db["voice_profiles"].find_one({"userId": ObjectId(user_id)})
    from app.database import local_store
    return await local_store.find_voice_profile(user_id)


async def enroll_voice_sample(
    user_id: str,
    sample_number: int,
    phrase: str,
    embedding: list,
) -> dict:
    db = get_db()
    if db is None:
        from app.database import local_store
        return await local_store.enroll_voice_sample(user_id, sample_number, phrase, embedding)

    from bson import ObjectId

    voice_profile = await db["voice_profiles"].find_one({"userId": ObjectId(user_id)})
    total_samples = 0

    if not voice_profile:
        voice_profile = {
            "userId": ObjectId(user_id),
            "voiceEmbeddings": embedding,
            "enrollmentSamples": 1,
            "sampleHistory": [sample_number],
            "samplePhrases": [phrase],
            "voiceModelVersion": VOICE_MODEL_VERSION,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }
        result = await db["voice_profiles"].insert_one(voice_profile)
        total_samples = 1
        await db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"voiceProfileId": str(result.inserted_id)}},
        )
    else:
        sample_phrases = voice_profile.get("samplePhrases", [])
        if sample_number == 1 and (
            len(sample_phrases) < 3
            or voice_profile.get("voiceModelVersion") != VOICE_MODEL_VERSION
        ):
            embeddings: list = []
            sample_history: list = []
            sample_phrases = []
        else:
            embeddings = list(voice_profile.get("voiceEmbeddings", []))
            sample_history = list(voice_profile.get("sampleHistory", []))

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
        await db["voice_profiles"].update_one(
            {"_id": voice_profile["_id"]},
            {
                "$set": {
                    "voiceEmbeddings": embeddings,
                    "sampleHistory": sample_history,
                    "samplePhrases": sample_phrases,
                    "enrollmentSamples": total_samples,
                    "voiceModelVersion": VOICE_MODEL_VERSION,
                    "updatedAt": datetime.utcnow(),
                }
            },
        )

    return {
        "totalSamples": total_samples,
        "enrolled": total_samples >= 3,
    }

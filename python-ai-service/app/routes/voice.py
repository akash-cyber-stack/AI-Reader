"""
Voice Verification API Routes
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
import logging

from app.models.schemas import VoiceVerificationResponse
from app.services.auth_service import AuthenticationService
from app.services.voice_service import VoiceVerificationService
from app.database import storage

logger = logging.getLogger(__name__)
router = APIRouter()
VOICE_MODEL_VERSION = storage.VOICE_MODEL_VERSION

auth_service = AuthenticationService()
voice_service = VoiceVerificationService()


def get_user_id_from_token(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = authorization.replace("Bearer ", "")
    user_id = auth_service.verify_token(token, 'access')

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user_id


@router.post("/enroll")
async def enroll_voice(
    file: UploadFile = File(...),
    sampleNumber: int = Form(..., ge=1, le=3),
    phrase: str = Form(..., min_length=5),
    authorization: str = Header(None)
):
    try:
        user_id = get_user_id_from_token(authorization)

        audio_data = await file.read()
        if not audio_data or len(audio_data) < 1000:
            raise HTTPException(status_code=400, detail="Invalid or empty audio file")

        embedding = await voice_service.enroll_voice([audio_data])
        result = await storage.enroll_voice_sample(user_id, sampleNumber, phrase, embedding)

        return {
            "success": True,
            "message": f"Voice sample {sampleNumber} enrolled successfully",
            "totalSamples": result["totalSamples"],
            "enrolled": result["enrolled"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice enrollment error: {e}")
        raise HTTPException(status_code=500, detail="Error enrolling voice")


@router.post("/verify", response_model=VoiceVerificationResponse)
async def verify_voice(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    try:
        user_id = get_user_id_from_token(authorization)

        audio_data = await file.read()
        if not audio_data:
            raise HTTPException(status_code=400, detail="Invalid or empty audio file")

        voice_profile = await storage.find_voice_profile(user_id)
        saved_phrases = voice_profile.get('samplePhrases', []) if voice_profile else []

        if (
            not voice_profile
            or voice_profile.get('enrollmentSamples', 0) < 3
            or len(saved_phrases) < 3
            or voice_profile.get('voiceModelVersion') != VOICE_MODEL_VERSION
            or not voice_profile.get('voiceEmbeddings')
        ):
            raise HTTPException(
                status_code=400,
                detail="Owner voice is not fully enrolled. Please save all 3 sentences first."
            )

        verified, similarity = await voice_service.verify_voice(
            audio_data,
            voice_profile['voiceEmbeddings']
        )

        return VoiceVerificationResponse(
            verified=verified,
            similarity=similarity,
            userId=user_id if verified else None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice verification error: {e}")
        raise HTTPException(status_code=500, detail="Error verifying voice")


@router.get("/status")
async def get_voice_status(authorization: str = Header(None)):
    try:
        user_id = get_user_id_from_token(authorization)
        voice_profile = await storage.find_voice_profile(user_id)

        if not voice_profile:
            return {
                "enrolled": False,
                "samples": 0,
                "requiredSamples": 3
            }

        sample_count = min(
            int(voice_profile.get('enrollmentSamples', 0)),
            len(voice_profile.get('voiceEmbeddings', [])),
            len(voice_profile.get('samplePhrases', [])),
            3
        )
        if voice_profile.get('voiceModelVersion') != VOICE_MODEL_VERSION:
            sample_count = 0

        return {
            "enrolled": sample_count >= 3,
            "samples": sample_count,
            "requiredSamples": 3,
            "samplePhrases": voice_profile.get('samplePhrases', []),
            "createdAt": voice_profile.get('createdAt')
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting voice status: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving voice status")

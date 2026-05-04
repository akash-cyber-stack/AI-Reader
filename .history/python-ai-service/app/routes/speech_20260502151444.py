"""
Speech Recognition API Routes
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Header, Query
import logging

from app.models.schemas import SpeechRecognitionResponse
from app.services.speech_service import SpeechRecognitionService
from app.services.auth_service import AuthenticationService

logger = logging.getLogger(__name__)
router = APIRouter()

speech_service = SpeechRecognitionService()
auth_service = AuthenticationService()

def get_user_id_from_token(authorization: str) -> str:
    """Extract and verify user ID from bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")
    
    token = authorization.replace("Bearer ", "")
    user_id = auth_service.verify_token(token, 'access')
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user_id

@router.post("/transcribe", response_model=SpeechRecognitionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Query("en", min_length=2, max_length=5),
    authorization: str = Header(None)
):
    """
    Transcribe audio file to text using Whisper
    
    Query parameters:
    - language: Language code (e.g., 'en', 'es', 'fr')
    """
    try:
        user_id = get_user_id_from_token(authorization)
        
        # Read audio file
        audio_data = await file.read()
        if not audio_data:
            raise HTTPException(status_code=400, detail="Invalid or empty audio file")
        
        # Transcribe
        text, confidence = await speech_service.transcribe(audio_data, language)
        
        return SpeechRecognitionResponse(
            text=text,
            confidence=confidence,
            language=language
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail="Error transcribing audio")

@router.post("/detect-language")
async def detect_language(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """
    Detect language from audio file
    """
    try:
        user_id = get_user_id_from_token(authorization)
        
        # Read audio file
        audio_data = await file.read()
        if not audio_data:
            raise HTTPException(status_code=400, detail="Invalid or empty audio file")
        
        # Detect language
        language = await speech_service.detect_language(audio_data)
        
        return {
            "language": language,
            "confidence": 0.95
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Language detection error: {e}")
        raise HTTPException(status_code=500, detail="Error detecting language")

@router.get("/supported-languages")
async def get_supported_languages():
    """Get list of supported languages"""
    return {
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "es", "name": "Spanish"},
            {"code": "fr", "name": "French"},
            {"code": "de", "name": "German"},
            {"code": "it", "name": "Italian"},
            {"code": "pt", "name": "Portuguese"},
            {"code": "ja", "name": "Japanese"},
            {"code": "zh", "name": "Chinese"},
            {"code": "ru", "name": "Russian"},
            {"code": "ar", "name": "Arabic"},
        ]
    }

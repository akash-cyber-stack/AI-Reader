"""
Voice Verification API Routes
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
import logging
from datetime import datetime

from app.models.schemas import VoiceEnrollmentRequest, VoiceVerificationRequest, VoiceVerificationResponse
from app.services.auth_service import AuthenticationService
from app.services.voice_service import VoiceVerificationService
from app.database.mongodb import get_db
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter()
VOICE_MODEL_VERSION = "wav-pcm-v1"

auth_service = AuthenticationService()
voice_service = VoiceVerificationService()

def get_user_id_from_token(authorization: str) -> str:
    """Extract and verify user ID from bearer token"""
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
    """
    Enroll a voice sample for speaker verification
    
    Form fields:
    - sampleNumber: Which owner sentence this is (1-3)
    - phrase: The exact sentence shown to the owner for this sample
    """
    try:
        user_id = get_user_id_from_token(authorization)
        
        # Read audio file
        audio_data = await file.read()
        if not audio_data or len(audio_data) < 1000:
            raise HTTPException(status_code=400, detail="Invalid or empty audio file")
        
        db = get_db()
        
        # Check if voice profile exists
        voice_profile = await db['voice_profiles'].find_one({'userId': ObjectId(user_id)})
        embedding = await voice_service.enroll_voice([audio_data])
        
        if not voice_profile:
            # Create new voice profile
            voice_profile = {
                'userId': ObjectId(user_id),
                'voiceEmbeddings': embedding,
                'enrollmentSamples': 1,
                'sampleHistory': [sampleNumber],
                'samplePhrases': [phrase],
                'voiceModelVersion': VOICE_MODEL_VERSION,
                'createdAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow()
            }
            
            result = await db['voice_profiles'].insert_one(voice_profile)
            total_samples = 1
            
            # Update user
            await db['users'].update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {'voiceProfileId': str(result.inserted_id)}}
            )
        else:
            sample_phrases = voice_profile.get('samplePhrases', [])
            if sampleNumber == 1 and (
                len(sample_phrases) < 3
                or voice_profile.get('voiceModelVersion') != VOICE_MODEL_VERSION
            ):
                embeddings = []
                sample_history = []
                sample_phrases = []
            else:
                embeddings = voice_profile.get('voiceEmbeddings', [])
                sample_history = voice_profile.get('sampleHistory', [])

            if sampleNumber in sample_history:
                sample_index = sample_history.index(sampleNumber)
                if sample_index < len(embeddings):
                    embeddings[sample_index] = embedding[0]
                if sample_index < len(sample_phrases):
                    sample_phrases[sample_index] = phrase
            else:
                embeddings.append(embedding[0])
                sample_history.append(sampleNumber)
                sample_phrases.append(phrase)

            total_samples = len(set(sample_history))

            await db['voice_profiles'].update_one(
                {'_id': voice_profile['_id']},
                {
                    '$set': {
                        'voiceEmbeddings': embeddings,
                        'sampleHistory': sample_history,
                        'samplePhrases': sample_phrases,
                        'enrollmentSamples': total_samples,
                        'voiceModelVersion': VOICE_MODEL_VERSION,
                        'updatedAt': datetime.utcnow()
                    },
                }
            )
        
        return {
            "success": True,
            "message": f"Voice sample {sampleNumber} enrolled successfully",
            "totalSamples": total_samples,
            "enrolled": total_samples >= 3
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
    """
    Verify voice against stored profile
    """
    try:
        user_id = get_user_id_from_token(authorization)
        
        # Read audio file
        audio_data = await file.read()
        if not audio_data:
            raise HTTPException(status_code=400, detail="Invalid or empty audio file")
        
        db = get_db()
        
        # Get voice profile
        voice_profile = await db['voice_profiles'].find_one({'userId': ObjectId(user_id)})
        
        saved_phrases = voice_profile.get('samplePhrases', []) if voice_profile else []
        if (
            not voice_profile
            or voice_profile.get('enrollmentSamples', 0) < 3
            or len(saved_phrases) < 3
            or voice_profile.get('voiceModelVersion') != VOICE_MODEL_VERSION
            or not voice_profile.get('voiceEmbeddings')
        ):
            raise HTTPException(status_code=400, detail="Owner voice is not fully enrolled. Please save all 3 sentences first.")
        
        # Verify voice
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
    """Get voice profile enrollment status"""
    try:
        user_id = get_user_id_from_token(authorization)
        
        db = get_db()
        voice_profile = await db['voice_profiles'].find_one({'userId': ObjectId(user_id)})
        
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

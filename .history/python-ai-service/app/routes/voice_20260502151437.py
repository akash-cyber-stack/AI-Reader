"""
Voice Verification API Routes
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Header, Query
import logging
import io

from app.models.schemas import VoiceEnrollmentRequest, VoiceVerificationRequest, VoiceVerificationResponse
from app.services.auth_service import AuthenticationService
from app.services.voice_service import VoiceVerificationService
from app.database.mongodb import get_db
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter()

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
    sampleNumber: int = Query(1, ge=1, le=10),
    authorization: str = Header(None)
):
    """
    Enroll a voice sample for speaker verification
    
    Query parameters:
    - sampleNumber: Which sample number this is (1-10)
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
        
        if not voice_profile:
            # Create new voice profile
            embedding = await voice_service.enroll_voice([audio_data])
            
            voice_profile = {
                'userId': ObjectId(user_id),
                'voiceEmbeddings': embedding,
                'enrollmentSamples': 1,
                'sampleHistory': [sampleNumber]
            }
            
            result = await db['voice_profiles'].insert_one(voice_profile)
            
            # Update user
            await db['users'].update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {'voiceProfileId': str(result.inserted_id)}}
            )
        else:
            # Add to existing profile
            embedding = await voice_service.enroll_voice([audio_data])
            await db['voice_profiles'].update_one(
                {'_id': voice_profile['_id']},
                {
                    '$push': {
                        'voiceEmbeddings': embedding[0],
                        'sampleHistory': sampleNumber
                    },
                    '$set': {'enrollmentSamples': voice_profile['enrollmentSamples'] + 1}
                }
            )
        
        return {
            "success": True,
            "message": f"Voice sample {sampleNumber} enrolled successfully",
            "totalSamples": voice_profile.get('enrollmentSamples', 1) if voice_profile else 1
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
        
        if not voice_profile or not voice_profile.get('voiceEmbeddings'):
            raise HTTPException(status_code=400, detail="No voice profile found. Please enroll first.")
        
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
                "samples": 0
            }
        
        return {
            "enrolled": True,
            "samples": voice_profile.get('enrollmentSamples', 0),
            "createdAt": voice_profile.get('createdAt')
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting voice status: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving voice status")

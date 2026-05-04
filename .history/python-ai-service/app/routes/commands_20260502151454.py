"""
Command Processing API Routes
"""

from fastapi import APIRouter, HTTPException, Header
import logging
from datetime import datetime

from app.models.schemas import ProcessCommandRequest, ProcessCommandResponse
from app.services.command_service import CommandInterpreterService
from app.services.auth_service import AuthenticationService
from app.database.mongodb import get_db
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter()

command_service = CommandInterpreterService()
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

@router.post("/interpret", response_model=ProcessCommandResponse)
async def interpret_command(
    request: ProcessCommandRequest,
    authorization: str = Header(None)
):
    """
    Convert natural language text to structured command
    """
    try:
        user_id = get_user_id_from_token(authorization)
        
        # Verify request user matches token
        if request.userId != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        if not request.text or len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Empty command text")
        
        # Interpret command
        action, confidence, voice_response = await command_service.interpret_command(request.text)
        
        # Check if command requires confirmation
        dangerous_commands = command_service.get_dangerous_commands()
        requires_confirmation = action['type'] in dangerous_commands
        
        return ProcessCommandResponse(
            command=request.text,
            action=action,
            confidence=confidence,
            voiceResponse=voice_response,
            requiresConfirmation=requires_confirmation
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Command interpretation error: {e}")
        raise HTTPException(status_code=500, detail="Error interpreting command")

@router.post("/log-execution")
async def log_command_execution(
    execution_log: dict,
    authorization: str = Header(None)
):
    """
    Log command execution for audit trail
    """
    try:
        user_id = get_user_id_from_token(authorization)
        
        if execution_log.get('userId') != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        db = get_db()
        
        # Create log entry
        log_entry = {
            'userId': ObjectId(user_id),
            'command': execution_log.get('command', ''),
            'action': execution_log.get('action', {}),
            'status': execution_log.get('status', 'UNKNOWN'),
            'result': execution_log.get('result'),
            'error': execution_log.get('error'),
            'voiceResponse': execution_log.get('voiceResponse', ''),
            'timestamp': datetime.utcnow()
        }
        
        # Insert log
        result = await db['command_logs'].insert_one(log_entry)
        
        logger.info(f"Command execution logged: {execution_log.get('command')} (User: {user_id})")
        
        return {
            "success": True,
            "logId": str(result.inserted_id),
            "message": "Execution logged successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging execution: {e}")
        raise HTTPException(status_code=500, detail="Error logging execution")

@router.get("/execution-history")
async def get_execution_history(
    limit: int = 50,
    skip: int = 0,
    authorization: str = Header(None)
):
    """
    Get command execution history for current user
    """
    try:
        user_id = get_user_id_from_token(authorization)
        
        db = get_db()
        
        # Fetch logs (note: not visible in UI but accessible for debugging)
        logs = await db['command_logs'].find(
            {'userId': ObjectId(user_id)}
        ).sort('timestamp', -1).skip(skip).limit(limit).to_list(None)
        
        # Convert ObjectId to string
        for log in logs:
            log['_id'] = str(log['_id'])
            log['userId'] = str(log['userId'])
        
        # Get total count
        total = await db['command_logs'].count_documents({'userId': ObjectId(user_id)})
        
        return {
            "total": total,
            "limit": limit,
            "skip": skip,
            "logs": logs
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching execution history: {e}")
        raise HTTPException(status_code=500, detail="Error fetching history")

@router.get("/dangerous-commands")
async def get_dangerous_commands():
    """Get list of commands that require confirmation"""
    dangerous = command_service.get_dangerous_commands()
    safe = command_service.get_safe_commands()
    
    return {
        "dangerous": dangerous,
        "safe": safe
    }

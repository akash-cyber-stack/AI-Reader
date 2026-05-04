"""
Pydantic Models for Python AI Service
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

# === Authentication Models ===

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    email: Optional[EmailStr] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    token: str
    refreshToken: str
    expiresIn: int
    user: dict

# === Voice & Verification Models ===

class VoiceEnrollmentRequest(BaseModel):
    audioData: bytes
    sampleNumber: int = Field(..., ge=1, le=10)

class VoiceVerificationRequest(BaseModel):
    audioData: bytes

class VoiceVerificationResponse(BaseModel):
    verified: bool
    similarity: float = Field(..., ge=0.0, le=1.0)
    userId: Optional[str] = None

# === Speech Recognition Models ===

class SpeechRecognitionRequest(BaseModel):
    audioData: bytes
    language: str = "en"

class SpeechRecognitionResponse(BaseModel):
    text: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    language: str

# === Command Processing Models ===

class CommandType(str, Enum):
    OPEN_APP = "OPEN_APP"
    OPEN_URL = "OPEN_URL"
    CLOSE_APP = "CLOSE_APP"
    DELETE_FILE = "DELETE_FILE"
    CREATE_FILE = "CREATE_FILE"
    OPEN_FOLDER = "OPEN_FOLDER"
    SET_VOLUME = "SET_VOLUME"
    SCREENSHOT = "SCREENSHOT"
    SYSTEM_SHUTDOWN = "SYSTEM_SHUTDOWN"
    SYSTEM_RESTART = "SYSTEM_RESTART"
    CUSTOM_COMMAND = "CUSTOM_COMMAND"

class CommandAction(BaseModel):
    type: CommandType
    parameters: dict = {}
    requiresConfirmation: bool = False

class ProcessCommandRequest(BaseModel):
    text: str
    userId: str

class ProcessCommandResponse(BaseModel):
    command: str
    action: CommandAction
    confidence: float = Field(..., ge=0.0, le=1.0)
    voiceResponse: str
    requiresConfirmation: bool = False

# === Execution Logging Models ===

class ExecutionStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    EXECUTING = "EXECUTING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REJECTED = "REJECTED"

class CommandLog(BaseModel):
    userId: str
    command: str
    action: CommandAction
    status: ExecutionStatus
    result: Optional[str] = None
    error: Optional[str] = None
    voiceResponse: str
    timestamp: datetime

# === User & Profile Models ===

class UserProfile(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    isOwner: bool = False
    voiceProfileId: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

# === Configuration Models ===

class ConfigUpdate(BaseModel):
    voiceConfidenceThreshold: Optional[float] = None
    ttsLanguage: Optional[str] = None
    audioSampleRate: Optional[int] = None

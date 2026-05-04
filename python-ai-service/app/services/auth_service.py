"""
Authentication Service
Handles user registration, login, JWT tokens, and voice enrollment
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext
from bson import ObjectId

from app.database.mongodb import get_db
from app.services.voice_service import VoiceVerificationService

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthenticationService:
    """User authentication and JWT management"""
    
    def __init__(self):
        """Initialize authentication service"""
        self.secret_key = os.getenv('JWT_SECRET', 'change_this_secret_key')
        self.refresh_secret = os.getenv('JWT_REFRESH_SECRET', 'change_this_refresh_key')
        self.algorithm = "HS256"
        self.access_expiry = os.getenv('JWT_EXPIRY', '24h')
        self.refresh_expiry = os.getenv('JWT_REFRESH_EXPIRY', '7d')
        self.voice_service = VoiceVerificationService()
        
        logger.info("Authentication Service initialized")
    
    async def register_user(self, username: str, password: str, email: Optional[str] = None) -> dict:
        """
        Register a new user
        
        Args:
            username: Unique username
            password: User password (will be hashed)
            email: Optional email address
        
        Returns:
            User document
        """
        try:
            db = get_db()
            
            # Check if user exists
            existing_user = await db['users'].find_one({'username': username})
            if existing_user:
                raise ValueError("Username already exists")
            
            # Hash password
            password_hash = pwd_context.hash(password)
            
            # Create user document
            user_doc = {
                'username': username,
                'email': email,
                'passwordHash': password_hash,
                'voiceProfileId': None,
                'isOwner': False,  # First user becomes owner
                'createdAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow()
            }
            
            # Check if this is the first user (becomes owner)
            user_count = await db['users'].count_documents({})
            if user_count == 0:
                user_doc['isOwner'] = True
                logger.info(f"First user registered as owner: {username}")
            
            # Insert user
            result = await db['users'].insert_one(user_doc)
            user_doc['_id'] = result.inserted_id
            
            logger.info(f"User registered: {username}")
            return user_doc
        except Exception as e:
            logger.error(f"Error registering user: {e}")
            raise
    
    async def login_user(self, username: str, password: str) -> tuple:
        """
        Authenticate user and generate tokens
        
        Args:
            username: Username
            password: Password
        
        Returns:
            Tuple of (access_token, refresh_token, user_doc)
        """
        try:
            db = get_db()
            
            # Find user
            user = await db['users'].find_one({'username': username})
            if not user:
                raise ValueError("Invalid username or password")
            
            # Verify password
            if not pwd_context.verify(password, user['passwordHash']):
                raise ValueError("Invalid username or password")
            
            # Generate tokens
            access_token = self._generate_token(str(user['_id']), 'access')
            refresh_token = self._generate_token(str(user['_id']), 'refresh')
            
            logger.info(f"User logged in: {username}")
            return access_token, refresh_token, user
        except Exception as e:
            logger.error(f"Error logging in user: {e}")
            raise
    
    async def enroll_voice_profile(self, user_id: str, voice_samples: list) -> dict:
        """
        Create voice profile for user during enrollment
        
        Args:
            user_id: User ID
            voice_samples: List of audio byte buffers
        
        Returns:
            Voice profile document
        """
        try:
            db = get_db()
            
            # Generate embeddings from voice samples
            embeddings = await self.voice_service.enroll_voice(voice_samples)
            
            # Create voice profile
            voice_profile = {
                'userId': ObjectId(user_id),
                'voiceEmbeddings': embeddings,
                'enrollmentSamples': len(voice_samples),
                'createdAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow()
            }
            
            # Insert voice profile
            result = await db['voice_profiles'].insert_one(voice_profile)
            voice_profile['_id'] = result.inserted_id
            
            # Update user with voice profile ID
            await db['users'].update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {'voiceProfileId': str(result.inserted_id)}}
            )
            
            logger.info(f"Voice profile created for user: {user_id}")
            return voice_profile
        except Exception as e:
            logger.error(f"Error enrolling voice: {e}")
            raise
    
    def _generate_token(self, user_id: str, token_type: str) -> str:
        """
        Generate JWT token
        
        Args:
            user_id: User ID
            token_type: 'access' or 'refresh'
        
        Returns:
            JWT token string
        """
        if token_type == 'access':
            secret = self.secret_key
            expiry_str = self.access_expiry
        else:
            secret = self.refresh_secret
            expiry_str = self.refresh_expiry
        
        # Parse expiry
        amount = int(expiry_str.replace('h', '').replace('d', ''))
        unit = 'h' if 'h' in expiry_str else 'd'
        
        if unit == 'h':
            expires = datetime.utcnow() + timedelta(hours=amount)
        else:
            expires = datetime.utcnow() + timedelta(days=amount)
        
        payload = {
            'sub': user_id,
            'exp': expires,
            'iat': datetime.utcnow(),
            'type': token_type
        }
        
        token = jwt.encode(payload, secret, algorithm=self.algorithm)
        return token
    
    def verify_token(self, token: str, token_type: str = 'access') -> Optional[str]:
        """
        Verify and decode JWT token
        
        Args:
            token: JWT token
            token_type: Expected token type
        
        Returns:
            User ID if valid, None otherwise
        """
        try:
            secret = self.secret_key if token_type == 'access' else self.refresh_secret
            payload = jwt.decode(token, secret, algorithms=[self.algorithm])
            
            if payload.get('type') != token_type:
                return None
            
            return payload.get('sub')
        except jwt.ExpiredSignatureError:
            logger.warning(f"Token expired")
            return None
        except jwt.InvalidTokenError:
            logger.warning(f"Invalid token")
            return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user document by ID"""
        try:
            db = get_db()
            user = await db['users'].find_one({'_id': ObjectId(user_id)})
            return user
        except Exception as e:
            logger.error(f"Error fetching user: {e}")
            return None

"""
Authentication Service
Handles user registration, login, JWT tokens, and voice enrollment
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional, List
import jwt
from passlib.context import CryptContext
from bson import ObjectId

from app.database import storage
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
    
    def _public_signup_allowed(self) -> bool:
        return os.getenv("ALLOW_PUBLIC_SIGNUP", "false").lower() == "true"

    async def register_user(
        self,
        username: str,
        password: str,
        email: Optional[str] = None,
        *,
        force_owner_create: bool = False,
        as_owner: bool = False,
    ) -> dict:
        """
        Register a user. Public signup only if ALLOW_PUBLIC_SIGNUP=true or first user.
        Owner may create users with force_owner_create=True.
        """
        try:
            user_count = await storage.count_users()
            if not force_owner_create and user_count > 0 and not self._public_signup_allowed():
                raise ValueError(
                    "Public registration is disabled. Ask the owner to create your account."
                )

            existing_user = await storage.find_user_by_username(username)
            if existing_user:
                raise ValueError("Username already exists")

            password_hash = pwd_context.hash(password)
            user_doc = {
                'username': username,
                'email': email,
                'passwordHash': password_hash,
                'voiceProfileId': None,
                'isOwner': False,
                'createdAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow()
            }

            if user_count == 0 and not force_owner_create:
                user_doc['isOwner'] = True
                logger.info(f"First user registered as owner: {username}")
            elif force_owner_create:
                user_doc['isOwner'] = bool(as_owner)

            user_doc = await storage.insert_user(user_doc)
            if not storage.mongo_available():
                logger.info("User registered (local storage): %s", username)
            else:
                logger.info("User registered: %s", username)
            return user_doc
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error registering user: {e}")
            raise ValueError("Could not register user. Please try again.") from e
    
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
            user = await storage.find_user_by_username(username)
            if not user:
                raise ValueError("Invalid username or password")

            if not pwd_context.verify(password, user['passwordHash']):
                raise ValueError("Invalid username or password")

            user_id = str(user['_id'])
            access_token = self._generate_token(user_id, 'access')
            refresh_token = self._generate_token(user_id, 'refresh')

            logger.info("User logged in: %s", username)
            return access_token, refresh_token, user
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error logging in user: {e}")
            raise ValueError("Login failed. Please try again.") from e
    
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
            embeddings = await self.voice_service.enroll_voice(voice_samples)
            from app.database.mongodb import get_db

            db = get_db()
            if db is not None:
                voice_profile = {
                    'userId': ObjectId(user_id),
                    'voiceEmbeddings': embeddings,
                    'enrollmentSamples': len(voice_samples),
                    'createdAt': datetime.utcnow(),
                    'updatedAt': datetime.utcnow()
                }
                result = await db['voice_profiles'].insert_one(voice_profile)
                voice_profile['_id'] = result.inserted_id
                await db['users'].update_one(
                    {'_id': ObjectId(user_id)},
                    {'$set': {'voiceProfileId': str(result.inserted_id)}}
                )
                return voice_profile

            import uuid
            profile_id = str(uuid.uuid4())
            await storage.update_user(user_id, {'voiceProfileId': profile_id})
            return {'_id': profile_id, 'userId': user_id, 'voiceEmbeddings': embeddings}
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
    
    async def require_owner(self, user_id: str) -> dict:
        user = await self.get_user_by_id(user_id)
        if not user or not user.get("isOwner"):
            raise ValueError("Owner access required")
        return user

    async def list_users(self) -> List[dict]:
        return await storage.list_users_public()

    async def create_user_as_owner(
        self,
        owner_id: str,
        username: str,
        password: str,
        email: Optional[str] = None,
    ) -> dict:
        await self.require_owner(owner_id)
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters")
        return await self.register_user(
            username, password, email, force_owner_create=True, as_owner=False
        )

    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user document by ID"""
        try:
            return await storage.find_user_by_id(user_id)
        except Exception as e:
            logger.error(f"Error fetching user: {e}")
            return None

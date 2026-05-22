"""
Authentication API Routes
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Header
from typing import Optional
import logging

from app.models.schemas import SignupRequest, LoginRequest, AuthResponse, CreateUserRequest
from app.services.auth_service import AuthenticationService

logger = logging.getLogger(__name__)
router = APIRouter()

auth_service = AuthenticationService()


def _user_id_from_header(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")
    token = authorization.replace("Bearer ", "")
    user_id = auth_service.verify_token(token, "access")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


@router.get("/users")
async def list_users(authorization: str = Header(None)):
    """List users (owner only)."""
    try:
        owner_id = _user_id_from_header(authorization)
        await auth_service.require_owner(owner_id)
        users = await auth_service.list_users()
        return {"success": True, "users": users}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/users")
async def create_user(request: CreateUserRequest, authorization: str = Header(None)):
    """Create a user (owner only)."""
    try:
        owner_id = _user_id_from_header(authorization)
        user = await auth_service.create_user_as_owner(
            owner_id, request.username, request.password, request.email
        )
        return {
            "success": True,
            "user": {
                "id": str(user["_id"]),
                "username": user["username"],
                "email": user.get("email"),
                "isOwner": user.get("isOwner", False),
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    """Register a new user"""
    try:
        # Register user
        user = await auth_service.register_user(
            username=request.username,
            password=request.password,
            email=request.email
        )
        
        # Generate tokens
        access_token = auth_service._generate_token(str(user['_id']), 'access')
        refresh_token = auth_service._generate_token(str(user['_id']), 'refresh')
        
        # Calculate expiry
        import os
        expiry_str = os.getenv('JWT_EXPIRY', '24h')
        expiry_amount = int(expiry_str.replace('h', '').replace('d', ''))
        expiry_seconds = expiry_amount * 3600 if 'h' in expiry_str else expiry_amount * 86400
        
        return AuthResponse(
            token=access_token,
            refreshToken=refresh_token,
            expiresIn=expiry_seconds,
            user={
                'id': str(user['_id']),
                'username': user['username'],
                'email': user.get('email'),
                'isOwner': user.get('isOwner', False)
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Authenticate user and generate tokens"""
    try:
        access_token, refresh_token, user = await auth_service.login_user(
            username=request.username,
            password=request.password
        )
        
        import os
        expiry_str = os.getenv('JWT_EXPIRY', '24h')
        expiry_amount = int(expiry_str.replace('h', '').replace('d', ''))
        expiry_seconds = expiry_amount * 3600 if 'h' in expiry_str else expiry_amount * 86400
        
        return AuthResponse(
            token=access_token,
            refreshToken=refresh_token,
            expiresIn=expiry_seconds,
            user={
                'id': str(user['_id']),
                'username': user['username'],
                'email': user.get('email'),
                'isOwner': user.get('isOwner', False)
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/refresh")
async def refresh_token(authorization: str = Header(None)):
    """Refresh access token using refresh token"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid token")
        
        refresh_token = authorization.replace("Bearer ", "")
        
        # Verify refresh token
        user_id = auth_service.verify_token(refresh_token, 'refresh')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
        
        # Generate new access token
        new_access_token = auth_service._generate_token(user_id, 'access')
        
        import os
        expiry_str = os.getenv('JWT_EXPIRY', '24h')
        expiry_amount = int(expiry_str.replace('h', '').replace('d', ''))
        expiry_seconds = expiry_amount * 3600 if 'h' in expiry_str else expiry_amount * 86400
        
        return {
            "token": new_access_token,
            "expiresIn": expiry_seconds,
            "type": "Bearer"
        }
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/verify-token")
async def verify_token(authorization: str = Header(None)):
    """Verify if token is valid"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            return {"valid": False}
        
        token = authorization.replace("Bearer ", "")
        user_id = auth_service.verify_token(token, 'access')
        
        if not user_id:
            return {"valid": False}
        
        # Get user info
        user = await auth_service.get_user_by_id(user_id)
        
        return {
            "valid": True,
            "userId": user_id,
            "user": {
                "username": user['username'],
                "email": user.get('email'),
                "isOwner": user.get('isOwner', False)
            }
        }
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return {"valid": False}

"""
FastAPI AI Service
Main entry point for the AI processing backend
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.routes import auth, voice, commands, speech
from app.database.mongodb import init_db

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Assistant - Python Service",
    description="Voice processing, AI commands, and speaker verification",
    version="1.0.0"
)

# Configure CORS
cors_origins = os.getenv('CORS_ORIGIN', 'http://localhost:3000,http://localhost:5000').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
@app.on_event("startup")
async def startup_event():
    """Initialize database and load models on startup"""
    logger.info("Starting up AI service...")
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as exc:
        logger.warning(
            "MongoDB not available (%s). Using local file storage in python-ai-service/data/",
            exc,
        )
    logger.info("AI Service started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down AI service...")

# Include routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice & Verification"])
app.include_router(speech.router, prefix="/api/speech", tags=["Speech Recognition"])
app.include_router(commands.router, prefix="/api/commands", tags=["Command Processing"])

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AI Assistant - Python Backend",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AI Assistant Python Service API",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', os.getenv('PYTHON_AI_PORT', 8000)))
    reload = os.getenv('PYTHON_RELOAD', 'false').lower() == 'true'
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=reload,
    )

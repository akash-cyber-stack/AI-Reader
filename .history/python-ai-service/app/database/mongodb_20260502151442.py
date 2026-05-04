"""
MongoDB Database Configuration
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

client: AsyncIOMotorClient = None
db: AsyncIOMotorDatabase = None

async def init_db():
    """Initialize MongoDB connection"""
    global client, db
    
    mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/ai-assistant')
    client = AsyncIOMotorClient(mongodb_uri)
    db = client.get_database()
    
    # Create indexes
    await create_indexes()

async def close_db():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()

async def create_indexes():
    """Create database indexes for performance"""
    global db
    
    if db:
        # User indexes
        await db['users'].create_index('username', unique=True)
        await db['users'].create_index('email', unique=True, sparse=True)
        
        # Voice profile indexes
        await db['voice_profiles'].create_index('userId')
        
        # Command execution logs
        await db['command_logs'].create_index('userId')
        await db['command_logs'].create_index('timestamp')
        await db['command_logs'].create_index([('userId', 1), ('timestamp', -1)])

def get_db() -> AsyncIOMotorDatabase:
    """Get database instance"""
    return db

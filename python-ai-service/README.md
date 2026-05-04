# Python AI Service

FastAPI-based backend for voice processing, speaker verification, speech recognition, and command interpretation.

## Architecture

```
FastAPI Application
├── Authentication Service
│   ├── User registration with password hashing (bcrypt)
│   ├── JWT token generation and verification
│   └── Voice profile management
├── Voice Verification Service (Speaker Recognition)
│   ├── Voice enrollment (generates embeddings)
│   ├── Voice verification against stored profiles
│   └── Cosine similarity matching
├── Speech Recognition Service (Whisper)
│   ├── Audio-to-text transcription
│   ├── Language detection
│   └── Confidence scoring
└── Command Interpreter Service (LLM)
    ├── Natural language to structured command conversion
    ├── Command validation
    └── Confidence ranking
```

## Installation

### 1. Create Virtual Environment

```bash
python -m venv venv

# Activate
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

## Running the Service

```bash
# Development with auto-reload
python -m app.main

# Or with uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The service will be available at: `http://localhost:8000`

**API Documentation**: `http://localhost:8000/docs`

## Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/ai-assistant
MONGODB_USER=admin
MONGODB_PASSWORD=changeme

# JWT
JWT_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d

# Voice
VOICE_CONFIDENCE_THRESHOLD=0.85
VOICE_ENROLLMENT_SAMPLES=3

# Speech
WHISPER_MODEL=base
AUDIO_SAMPLE_RATE=16000

# AI
OPENAI_API_KEY=your_openai_key

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5000

# Logging
LOG_LEVEL=debug
```

## API Routes

### Authentication (`/api/auth`)

**POST /signup**
```json
{
  "username": "john_doe",
  "password": "secure_password",
  "email": "john@example.com"
}
```

**POST /login**
```json
{
  "username": "john_doe",
  "password": "secure_password"
}
```

**POST /refresh**
- Header: `Authorization: Bearer <refresh_token>`

### Voice Verification (`/api/voice`)

**POST /enroll**
- Multipart form data with audio file
- Query: `sampleNumber=1` (1-10)
- Header: `Authorization: Bearer <token>`

**POST /verify**
- Multipart form data with audio file
- Header: `Authorization: Bearer <token>`
- Returns: `{ verified: bool, similarity: float }`

**GET /status**
- Header: `Authorization: Bearer <token>`
- Returns enrollment status

### Speech Recognition (`/api/speech`)

**POST /transcribe**
- Multipart form data with audio file
- Query: `language=en`
- Header: `Authorization: Bearer <token>`
- Returns: `{ text: str, confidence: float, language: str }`

**POST /detect-language**
- Multipart form data with audio file
- Header: `Authorization: Bearer <token>`
- Returns: `{ language: str, confidence: float }`

### Commands (`/api/commands`)

**POST /interpret**
```json
{
  "text": "open chrome",
  "userId": "user_id"
}
```
Header: `Authorization: Bearer <token>`

**POST /log-execution**
```json
{
  "userId": "user_id",
  "command": "open chrome",
  "action": { "type": "OPEN_APP", "parameters": {...} },
  "status": "SUCCESS",
  "result": "Chrome opened",
  "voiceResponse": "Opening Chrome"
}
```

**GET /execution-history**
- Query: `limit=50&skip=0`
- Header: `Authorization: Bearer <token>`

## Services Documentation

### Voice Verification Service

```python
from app.services.voice_service import VoiceVerificationService

service = VoiceVerificationService()

# Enroll voice samples
embeddings = await service.enroll_voice([audio_bytes_1, audio_bytes_2, audio_bytes_3])

# Verify voice
verified, similarity = await service.verify_voice(
    new_audio_bytes,
    stored_embeddings
)
```

**Implementation Notes:**
- Uses embedding vectors (512-dimensional)
- Cosine similarity for comparison
- Configurable threshold for verification
- Multiple samples for robustness

### Speech Recognition Service

```python
from app.services.speech_service import SpeechRecognitionService

service = SpeechRecognitionService()

# Transcribe audio
text, confidence = await service.transcribe(audio_bytes, language="en")

# Detect language
language = await service.detect_language(audio_bytes)
```

**Implementation Notes:**
- Uses OpenAI Whisper model
- Supports multiple languages
- Returns confidence scores
- Handles various audio formats

### Command Interpreter Service

```python
from app.services.command_service import CommandInterpreterService

service = CommandInterpreterService()

# Interpret natural language
action, confidence, voice_response = await service.interpret_command(
    "open chrome"
)

# Check if dangerous
dangerous_commands = service.get_dangerous_commands()
```

**Implementation Notes:**
- Uses GPT-4 for command interpretation
- Structured command output
- Automatic safety classification
- Confidence scoring

### Authentication Service

```python
from app.services.auth_service import AuthenticationService

service = AuthenticationService()

# Register user
user = await service.register_user("username", "password", "email@example.com")

# Login
access_token, refresh_token, user = await service.login_user("username", "password")

# Verify token
user_id = service.verify_token(token, "access")

# Enroll voice
profile = await service.enroll_voice_profile(user_id, voice_samples)
```

## Database Schema

### Users Collection

```json
{
  "_id": ObjectId,
  "username": "john_doe",
  "email": "john@example.com",
  "passwordHash": "$2b$10$...",
  "voiceProfileId": ObjectId,
  "isOwner": true,
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

### Voice Profiles Collection

```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "voiceEmbeddings": [[0.1, 0.2, ...], [0.15, 0.25, ...]],
  "enrollmentSamples": 3,
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

### Command Logs Collection

```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "command": "open chrome",
  "action": {
    "type": "OPEN_APP",
    "parameters": {"appName": "chrome"},
    "requiresConfirmation": false
  },
  "status": "SUCCESS",
  "result": "Chrome opened",
  "error": null,
  "voiceResponse": "Opening Chrome",
  "timestamp": ISODate
}
```

## Deployment

### With Gunicorn (Production)

```bash
pip install gunicorn

gunicorn -w 4 -b 0.0.0.0:8000 app.main:app
```

### With Docker

```bash
docker build -t ai-assistant-python .
docker run -p 8000:8000 --env-file .env ai-assistant-python
```

## Monitoring

### Health Check

```bash
curl http://localhost:8000/health
```

### Logs

```python
import logging
logger = logging.getLogger(__name__)

logger.info("Information message")
logger.error("Error message")
logger.warning("Warning message")
```

## Performance Optimization

1. **Database Connection Pooling**: Motor handles async connections
2. **Caching**: Consider implementing Redis for token caching
3. **Async All The Way**: All I/O operations are async
4. **Load Balancing**: Use nginx for multiple instances
5. **Rate Limiting**: Implement with slowapi

## Security Best Practices

1. ✅ Password hashing with bcrypt
2. ✅ JWT token expiration
3. ✅ CORS configuration
4. ✅ Input validation with Pydantic
5. ✅ Secure database connections
6. ✅ Environment variable management

**To Improve:**
- [ ] Add rate limiting
- [ ] Implement HTTPS
- [ ] Add request signing
- [ ] Implement audit logging
- [ ] Add API key management

## Troubleshooting

### Import Errors

```bash
# Reinstall dependencies
pip install --force-reinstall -r requirements.txt
```

### Database Connection Issues

```bash
# Verify MongoDB running
mongosh
# Check connection string in .env
```

### Microphone/Audio Issues

```bash
# Install audio dependencies (Linux)
sudo apt-get install python3-dev libportaudio2 portaudio19-dev
pip install pyaudio
```

## Testing

```bash
# Create test file
pytest tests/

# With coverage
pytest --cov=app tests/
```

## Contributing

1. Create feature branch
2. Follow PEP 8 style guide
3. Add tests for new features
4. Update documentation
5. Submit pull request

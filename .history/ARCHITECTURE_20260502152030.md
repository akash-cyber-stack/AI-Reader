# System Architecture

## Overview

The AI Desktop Assistant is a three-tier distributed system with separated concerns for frontend, system control, and AI processing.

```
┌─────────────────────────────────────────────────────────┐
│                   USER INTERFACE TIER                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │      Electron Desktop Application (TypeScript)     │  │
│  │  - Voice capture via Web Audio API                │  │
│  │  - Status indicators only (NO text display)       │  │
│  │  - UI state management                           │  │
│  │  - Session management                            │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────────┘
               │ HTTP REST API (dual-stream)
       ┌───────┴────────────┬───────────────┐
       │                    │               │
┌──────▼──────┐  ┌──────────▼──────┐  ┌────▼──────────┐
│   NODE.JS   │  │ PYTHON FASTAPI  │  │   MONGODB    │
│ BACKEND     │  │ AI SERVICE      │  │   DATABASE   │
│ (Port 5000) │  │ (Port 8000)     │  │ (Port 27017) │
│             │  │                 │  │              │
└─────────────┘  └─────────────────┘  └──────────────┘
```

## Architectural Layers

### 1. Presentation Layer (Electron)

**Components:**
- Main Process: Window management, IPC
- Renderer Process: React UI components
- Preload Script: Secure API exposure

**Responsibilities:**
- Audio capture from microphone
- UI rendering (status indicators only)
- Session/token management
- Navigation between pages

**No Text Display:**
- Commands never displayed to user
- Only status indicators shown
- Audio feedback only (text-to-speech)
- All sensitive data in backend

### 2. API Gateway Layer (Node.js Backend)

**Purpose:** Bridge between Electron and Python service, system control

**Components:**
- Express.js HTTP server
- Authentication middleware
- System control service
- Command orchestration

**Responsibilities:**
- User authentication proxy
- Audio data relay
- System command execution
- Permission enforcement
- Logging and audit trail

**Flow:**
```
Electron App
    ↓
Node.js Backend
    ├→ Python AI Service (voice/command processing)
    ├→ System Controller (execute commands)
    └→ MongoDB (logging)
```

### 3. AI Processing Layer (Python FastAPI)

**Purpose:** Speech/voice processing and command interpretation

**Components:**
- FastAPI server
- Authentication service
- Voice verification service
- Speech recognition service
- Command interpreter service

**Responsibilities:**
- User registration and JWT management
- Voice enrollment and verification
- Speech-to-text conversion
- Command interpretation with LLM
- Validation and safety checks

### 4. Data Layer (MongoDB)

**Collections:**
- `users`: User accounts and credentials
- `voice_profiles`: Voice embeddings for speaker verification
- `command_logs`: Command execution history and audit trail
- `sessions`: Active user sessions

## Data Flow: Voice Command Execution

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER SPEAKS COMMAND                                      │
│    "Open Chrome"                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ELECTRON APP - AUDIO CAPTURE                             │
│    ├─ Web Audio API captures microphone stream             │
│    ├─ Encodes as WAV/MP3                                  │
│    └─ Sends to Node.js backend                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. NODE.JS BACKEND - RELAY                                  │
│    ├─ Receives audio from Electron                         │
│    ├─ Forwards to Python service                           │
│    └─ Awaits response                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. PYTHON SERVICE - VOICE VERIFICATION                      │
│    ├─ Extract voice features from audio                    │
│    ├─ Generate embedding vector                            │
│    ├─ Compare with stored embeddings                       │
│    └─ If NOT verified:                                     │
│         └─ Return: "You are not the owner"                 │
│       If verified:                                         │
│         └─ Continue to step 5                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. PYTHON SERVICE - SPEECH-TO-TEXT                          │
│    ├─ Load Whisper model                                   │
│    ├─ Transcribe audio: "Open Chrome"                      │
│    └─ Return text + confidence score                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. PYTHON SERVICE - COMMAND INTERPRETATION                  │
│    ├─ Send text to GPT-4: "Open Chrome"                    │
│    ├─ Receive structured command:                          │
│    │   {                                                   │
│    │     "type": "OPEN_APP",                              │
│    │     "parameters": {"appName": "chrome"},             │
│    │     "requiresConfirmation": false                    │
│    │   }                                                   │
│    └─ Return to Node.js backend                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. NODE.JS BACKEND - COMMAND EXECUTION                      │
│    ├─ Receive parsed command                               │
│    ├─ Validate parameters                                  │
│    ├─ Check if dangerous (DELETE_FILE, SHUTDOWN, etc)    │
│    │                                                       │
│    ├─ If dangerous:                                        │
│    │   └─ Return to Electron: "Confirmation needed"      │
│    │                                                       │
│    └─ If safe:                                             │
│        ├─ Execute via systemService                        │
│        ├─ Execute: spawn('chrome')                         │
│        └─ Continue to step 8                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. SYSTEM EXECUTION                                         │
│    ├─ Spawn child process                                  │
│    ├─ Chrome application opens                             │
│    └─ Execution completes successfully                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. LOGGING                                                   │
│    ├─ Log to MongoDB:                                       │
│    │   {                                                    │
│    │     "userId": "user123",                              │
│    │     "command": "open chrome",                         │
│    │     "action": {"type": "OPEN_APP", ...},             │
│    │     "status": "SUCCESS",                              │
│    │     "timestamp": "2024-01-15T10:30:00Z"              │
│    │   }                                                    │
│    └─ Logs NOT visible in UI                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. AUDIO FEEDBACK                                          │
│    ├─ Generate TTS: "Opening Chrome"                        │
│    ├─ Send audio to Electron app                           │
│    ├─ Play through speakers                                │
│    └─ NO text displayed to user                            │
└─────────────────────────────────────────────────────────────┘
```

## Security Architecture

### Authentication Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. USER LOGIN                                            │
│    POST /api/auth/login {username, password}            │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ 2. PYTHON SERVICE - PASSWORD VERIFICATION               │
│    ├─ Find user by username                             │
│    ├─ Compare password with bcrypt hash                 │
│    └─ If mismatch → Reject                              │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ 3. JWT TOKEN GENERATION                                 │
│    ├─ Create payload:                                   │
│    │   {sub: userId, exp: now+24h, type: "access"}     │
│    ├─ Sign with JWT_SECRET                              │
│    └─ Return to Electron app                            │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ 4. VOICE ENROLLMENT                                     │
│    ├─ User records 3 voice samples                      │
│    ├─ Generate embeddings from each                     │
│    ├─ Store encrypted in MongoDB                        │
│    └─ Ready for verification                            │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ 5. DAILY VOICE VERIFICATION (on command)               │
│    ├─ Extract embedding from user's voice              │
│    ├─ Compare with stored embeddings                   │
│    ├─ Calculate cosine similarity                       │
│    │   If > THRESHOLD (0.85): Verified                 │
│    │   If < THRESHOLD: Rejected                        │
│    └─ Allow/deny command execution                      │
└──────────────────────────────────────────────────────────┘
```

### Permission Model

```
User Types:
├─ Owner (isOwner=true)
│  └─ Can execute all commands
│     Can view system settings
│     Can manage other users (future)
│
└─ Guest/Limited (isOwner=false)
   └─ Cannot execute dangerous commands
      Cannot access system logs
      Limited to safe commands only
```

### Command Safety Classification

```
SAFE COMMANDS (no confirmation)
├─ OPEN_APP
├─ CLOSE_APP
└─ SCREENSHOT

DANGEROUS COMMANDS (require confirmation)
├─ DELETE_FILE
├─ SYSTEM_SHUTDOWN
├─ SYSTEM_RESTART
└─ (custom dangerous commands)
```

## Scalability Considerations

### Horizontal Scaling

```
Load Balancer (nginx)
    │
    ├──→ Python Service 1
    ├──→ Python Service 2
    └──→ Python Service 3

MongoDB Replica Set
    ├─ Primary (reads/writes)
    ├─ Secondary (reads only)
    └─ Secondary (reads only)

Node.js Backend (stateless, multiple instances)
    ├─ Instance 1
    ├─ Instance 2
    └─ Instance 3
```

### Performance Optimization

1. **Async Processing**: All I/O operations non-blocking
2. **Connection Pooling**: MongoDB connection pool (10-50 connections)
3. **Caching**: Redis for token validation and command cache
4. **Message Queue**: Optional Kafka/RabbitMQ for command processing
5. **CDN**: Static files served via CDN
6. **Database Indexing**: Indexes on userId, timestamp, command fields

## Disaster Recovery

### Backup Strategy

```
Daily Backup
├─ MongoDB full backup
├─ Settings export
└─ User profiles export

Backup Location: Secure cloud storage (AWS S3, Google Cloud)

Recovery Procedure:
1. Restore MongoDB from backup
2. Restart services
3. Verify data integrity
4. Notify users
```

### Failover Mechanism

```
Primary Server Down
    ↓
Health check fails (3 consecutive failures)
    ↓
Failover to Backup Server
    ↓
Service restored with <30s downtime
```

## Monitoring & Observability

### Metrics to Track

1. **Availability**: Uptime percentage
2. **Performance**: Response time P99
3. **Reliability**: Error rate
4. **Voice Accuracy**: Verification success rate
5. **Command Success**: Execution success rate

### Logging Levels

```
DEBUG: Detailed diagnostic information
INFO: General informational messages
WARNING: Warning messages (non-critical issues)
ERROR: Error messages (critical issues)
```

### Example Log Entry

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "service": "node-backend",
  "message": "Command executed",
  "userId": "user123",
  "command": "open chrome",
  "status": "SUCCESS",
  "duration_ms": 245,
  "trace_id": "abc123def456"
}
```

## API Design Principles

### RESTful Conventions

- `GET /api/resource` - Retrieve
- `POST /api/resource` - Create
- `PUT /api/resource/:id` - Update
- `DELETE /api/resource/:id` - Delete

### Request/Response Format

```json
Request:
{
  "method": "POST",
  "headers": {"Authorization": "Bearer <token>"},
  "body": {"key": "value"}
}

Response:
{
  "success": true,
  "data": {...},
  "message": "Optional message",
  "timestamp": "2024-01-15T10:30:00Z"
}

Error:
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...}
}
```

## Technology Stack Justification

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend | Electron + React | Desktop app with web tech |
| UI Framework | CSS + Vanilla React | Minimal dependencies |
| Backend | Node.js + Express | Fast, event-driven I/O |
| AI Service | Python + FastAPI | ML library ecosystem |
| Database | MongoDB | Flexible schema, scalable |
| Auth | JWT + bcrypt | Stateless, secure |
| Voice Auth | Embeddings + Cosine | Lightweight, accurate |
| Speech-to-Text | OpenAI Whisper | Accurate, reliable |
| Command AI | GPT-4 | State-of-the-art reasoning |

## Future Enhancements

1. **Multi-user Support**: Separate profiles per user
2. **Custom Commands**: User-defined voice commands
3. **Offline Mode**: Cached commands, local execution
4. **Mobile App**: Mobile companion app
5. **Smart Automation**: Trigger-based commands
6. **Machine Learning**: Personalized command suggestions
7. **Analytics Dashboard**: Usage analytics and insights
8. **Plugin System**: Third-party integrations

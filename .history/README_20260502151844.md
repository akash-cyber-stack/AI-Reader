# 🎤 AI Desktop Assistant - Production-Grade Voice-Controlled System

A secure, voice-first desktop assistant with owner-only control, speaker verification, and no UI text exposure. Built with Electron, Node.js, Python, and MongoDB.

## ✨ Key Features

- **🎤 Voice-First Interface**: All interactions via voice - NO speech text displayed on screen
- **🔐 Owner-Only Control**: Speaker verification via voice embeddings + password authentication
- **🔒 Secure Command Execution**: Dangerous commands require voice confirmation
- **📊 Hidden Logging**: All commands logged securely in backend database (not visible in UI)
- **⚡ Production-Ready**: Enterprise-grade architecture with proper error handling
- **🌐 Hybrid Architecture**: Electron (frontend) + Node.js (system control) + Python (AI/speech)

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                      │
│  (TypeScript/React - Voice Control UI, NO Text Display)     │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴──────────┬────────────────────┐
    │                   │                    │
┌───▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│Node.js     │  │Python FastAPI│ │MongoDB Database │
│Backend     │  │AI Service    │ │(Secure Storage) │
│(System     │  │(Voice        │ │                 │
│Control)    │  │Processing)   │ │• User profiles  │
│            │  │              │ │• Voice profiles │
│• Apps      │  │• Whisper STT │ │• Command logs   │
│• Files     │  │• Voice Auth  │ │• Embeddings    │
│• System    │  │• LLM Commands│ │                 │
└────────────┘  └──────────────┘ └─────────────────┘
```

## 📋 Project Structure

```
AI Reader/
├── electron-app/              # Electron UI (TypeScript/React)
│   ├── src/
│   │   ├── main/              # Electron main process
│   │   ├── preload/           # Preload script (security)
│   │   ├── renderer/          # React components
│   │   │   ├── pages/         # Auth, Enrollment, Dashboard
│   │   │   └── styles/        # CSS (no command text shown)
│   │   └── App.tsx
│   ├── public/                # Static files
│   ├── package.json
│   └── tsconfig.json
│
├── node-backend/              # Node.js System Control Backend
│   ├── src/
│   │   ├── server.ts          # Express server
│   │   ├── routes/            # Auth, System, Commands, Logging
│   │   ├── services/          # SystemControl, CommandExecution
│   │   ├── middleware/        # Error handling, auth
│   │   └── utils/
│   ├── package.json
│   └── tsconfig.json
│
├── python-ai-service/         # Python FastAPI AI Backend
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── routes/            # Auth, Voice, Speech, Commands
│   │   ├── services/          # VoiceVerification, SpeechRecognition, CommandInterpreter
│   │   ├── models/            # Pydantic schemas
│   │   └── database/          # MongoDB connection
│   ├── requirements.txt
│   └── README.md
│
├── shared/                     # Shared types
│   └── types/
│       └── index.ts           # TypeScript interfaces
│
├── .env.example               # Configuration template
└── README.md                  # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 16+ (for Electron and backend)
- **Python** 3.8+ (for AI service)
- **MongoDB** 4.4+ (local or cloud)
- **Windows / macOS / Linux** (Electron-compatible OS)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd "AI Reader"

# Create environment file
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your editor
```

### 2. MongoDB Setup

```bash
# Option A: Local MongoDB
# Install MongoDB Community: https://docs.mongodb.com/manual/installation/

# Option B: MongoDB Atlas (Cloud)
# https://www.mongodb.com/cloud/atlas
# Update MONGODB_URI in .env

# Verify connection:
# mongosh "mongodb://localhost:27017"
```

### 3. Python AI Service Setup

```bash
cd python-ai-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the service
python -m app.main
# Service will start on http://localhost:8000

# Test health endpoint:
# curl http://localhost:8000/health
```

### 4. Node.js Backend Setup

```bash
cd node-backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the server
npm run dev
# Server will start on http://localhost:5000

# Test health endpoint:
# curl http://localhost:5000/health
```

### 5. Electron App Setup

```bash
cd electron-app

# Install dependencies
npm install

# Start in development mode (starts React dev server + Electron)
npm run dev

# Build for production:
npm run build
```

## 🔐 Security Features

### Voice Authentication Pipeline

```
1. User speaks command
   ↓
2. Audio sent to Python backend
   ↓
3. Speaker verification (compare with enrolled voice)
   ↓
4. If verified:
   ├─ Convert speech to text (Whisper)
   ├─ Interpret command with LLM
   └─ Execute via Node.js (with confirmation if dangerous)
   ↓
5. If NOT verified:
   └─ Return audio: "You are not the owner of this system."
```

### Password Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens for session authentication
- Token refresh mechanism (24h access, 7d refresh)
- Automatic logout on token expiry

### Command Execution Safety

**Safe Commands** (no confirmation needed):
- OPEN_APP
- CLOSE_APP
- SCREENSHOT

**Dangerous Commands** (require voice confirmation):
- DELETE_FILE
- SYSTEM_SHUTDOWN
- SYSTEM_RESTART

### Logging & Audit Trail

All commands logged in MongoDB:
- Command text (from user)
- Interpreted action
- Execution status
- Timestamp
- User ID

**Note**: Logs are NOT visible in the UI but accessible via backend API for debugging.

## 📱 User Workflow

### First-Time Setup

1. **Sign Up**: Create account with username + password
2. **Voice Enrollment**: Record 3 voice samples
3. **Verification**: System compares voice embeddings
4. **Ready**: Use voice commands

### Daily Usage

1. **Login**: Username + password
2. **Voice Unlock**: Speak (auto-verified)
3. **Voice Commands**: "Open Chrome", "Take screenshot", etc.
4. **Audio Response**: System confirms via TTS (no text shown)

## 🎙️ Command Examples

```
User: "Open Chrome"
System: Verifies speaker → Opens Chrome → Audio: "Opening Chrome"

User: "Delete downloads folder"
System: Verifies speaker → Audio: "Delete downloads? Confirm."
User: "Yes"
System: Deletes folder → Audio: "Folder deleted"

User: "Take screenshot"
System: Verifies → Screenshot saved → Audio: "Screenshot taken"
```

## 🛠️ API Endpoints

### Python AI Service (Port 8000)

**Authentication**
- `POST /api/auth/signup` - Register user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

**Voice**
- `POST /api/voice/enroll` - Enroll voice sample
- `POST /api/voice/verify` - Verify voice
- `GET /api/voice/status` - Check enrollment status

**Speech**
- `POST /api/speech/transcribe` - Convert speech to text
- `POST /api/speech/detect-language` - Detect language
- `GET /api/speech/supported-languages` - List languages

**Commands**
- `POST /api/commands/interpret` - Convert text to command
- `POST /api/commands/log-execution` - Log command
- `GET /api/commands/execution-history` - Get logs
- `GET /api/commands/dangerous-commands` - List dangerous commands

### Node.js Backend (Port 5000)

**Auth** (proxy to Python)
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

**System Control**
- `POST /api/system/open-app` - Open application
- `POST /api/system/close-app` - Close application
- `POST /api/system/delete-file` - Delete file (dangerous)
- `POST /api/system/screenshot` - Take screenshot
- `POST /api/system/set-volume` - Set volume (0-100)

**Commands**
- `POST /api/commands/process` - Full command pipeline
- `POST /api/commands/confirm` - Confirm dangerous command
- `GET /api/commands/history` - Execution history

**Logging**
- `GET /api/logging/logs` - System logs
- `GET /api/logging/stats` - Log statistics
- `POST /api/logging/write` - Write log entry

## 📊 Database Schema

### MongoDB Collections

```
users/
├── _id: ObjectId
├── username: string (unique)
├── email: string (unique, optional)
├── passwordHash: string
├── voiceProfileId: ObjectId
├── isOwner: boolean
├── createdAt: Date
└── updatedAt: Date

voice_profiles/
├── _id: ObjectId
├── userId: ObjectId
├── voiceEmbeddings: [number[]]  # 512-dim embeddings
├── enrollmentSamples: number
├── createdAt: Date
└── updatedAt: Date

command_logs/
├── _id: ObjectId
├── userId: ObjectId
├── command: string
├── action: object
├── status: "PENDING" | "PROCESSING" | "EXECUTING" | "SUCCESS" | "FAILED"
├── result: string (optional)
├── error: string (optional)
├── voiceResponse: string
└── timestamp: Date

sessions/
├── _id: ObjectId
├── userId: ObjectId
├── token: string
├── expiresAt: Date
└── createdAt: Date
```

## 🔧 Configuration

Edit `.env` to customize:

```env
# Node.js Backend
NODE_PORT=5000

# Python Service
PYTHON_AI_PORT=8000

# Database
MONGODB_URI=mongodb://localhost:27017/ai-assistant

# Security
JWT_SECRET=your_secret_key
BCRYPT_ROUNDS=10

# Voice
VOICE_CONFIDENCE_THRESHOLD=0.85
VOICE_ENROLLMENT_SAMPLES=3

# AI Models
OPENAI_API_KEY=your_openai_key
WHISPER_MODEL=base

# Commands
SAFE_COMMANDS=OPEN_APP,CLOSE_APP,SCREENSHOT
DANGEROUS_COMMANDS=DELETE_FILE,SYSTEM_SHUTDOWN,SYSTEM_RESTART
```

## 🚨 Troubleshooting

### "Microphone access denied"
- Check OS permissions (macOS: Settings → Privacy & Security → Microphone)
- Windows: Settings → Privacy & Security → Microphone

### "MongoDB connection failed"
- Ensure MongoDB is running: `mongosh`
- Check MONGODB_URI in .env
- Verify network connectivity

### "Python service not responding"
- Check if Python service is running on port 8000
- Review error logs in terminal
- Ensure all dependencies installed: `pip install -r requirements.txt`

### "Voice verification always fails"
- Re-enroll voice profile (3 clear samples)
- Ensure quiet environment during enrollment
- Verify VOICE_CONFIDENCE_THRESHOLD in .env

### "Commands not executing"
- Check Node.js backend is running
- Verify speaker identity passed verification
- Check command logs for errors: `GET /api/logging/logs`

## 📈 Performance Optimization

- **Async Operations**: All I/O operations use async/await
- **Connection Pooling**: MongoDB connection pooling enabled
- **Caching**: Token verification cached
- **Audio Compression**: Audio encoded efficiently for transmission

## 🔄 Development Workflow

```bash
# Terminal 1: Python AI Service
cd python-ai-service
source venv/bin/activate
python -m app.main

# Terminal 2: Node.js Backend
cd node-backend
npm run dev

# Terminal 3: Electron App
cd electron-app
npm run dev

# All three services running with hot-reload enabled
```

## 📝 Logging & Debugging

### View Logs

```bash
# Python service logs (console output)
# Node.js backend logs (console + logs/app.log)
curl http://localhost:5000/api/logging/logs

# Command execution history
curl http://localhost:5000/api/commands/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Enable Debug Mode

```bash
# Set in .env
LOG_LEVEL=debug
NODE_ENV=development
```

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Change all default secrets in .env
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS for all APIs
- [ ] Configure MongoDB with authentication
- [ ] Setup firewall rules
- [ ] Enable rate limiting
- [ ] Setup monitoring & alerts
- [ ] Configure automated backups

### Deployment Steps

1. **Build Electron App**
   ```bash
   cd electron-app
   npm run build
   # Outputs to dist/
   ```

2. **Deploy Python Service**
   ```bash
   cd python-ai-service
   # Use Gunicorn: gunicorn -w 4 -b 0.0.0.0:8000 app.main:app
   ```

3. **Deploy Node.js Backend**
   ```bash
   cd node-backend
   npm run build
   # Use PM2: pm2 start dist/server.js --name ai-backend
   ```

## 📄 License

[Your License Here]

## 🙋 Support

For issues, questions, or contributions:
1. Check troubleshooting section above
2. Review error logs
3. Open an issue with detailed description
4. Include logs and configuration (without secrets)

---

**Built with ❤️ for secure, voice-first desktop automation**

# 🚀 Quick Start Setup Guide

Complete step-by-step instructions to get the AI Assistant running in 30 minutes.

## Prerequisites Check

Before starting, ensure you have:

- **Node.js 16+**: Check with `node --version`
- **Python 3.8+**: Check with `python --version`
- **MongoDB**: Local or Atlas account
- **Git**: For version control

## Step 1: Environment Configuration (5 min)

```bash
# Navigate to project root
cd "AI Reader"

# Copy environment template
cp .env.example .env

# Edit environment variables
# Choose your preferred editor:
nano .env              # Linux/macOS
code .env              # VS Code
notepad .env           # Windows
```

**Key variables to configure:**

```env
# Database
MONGODB_URI=mongodb://localhost:27017/ai-assistant

# Backend ports
NODE_PORT=5000
PYTHON_AI_PORT=8000

# Security (change these!)
JWT_SECRET=generate_a_random_string_here
OPENAI_API_KEY=your_openai_api_key

# Voice settings
VOICE_CONFIDENCE_THRESHOLD=0.85
```

## Step 2: MongoDB Setup (5 min)

### Option A: Local MongoDB (Windows/macOS/Linux)

```bash
# Install MongoDB Community Edition
# Windows: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/
# macOS: brew install mongodb-community
# Linux: Follow official docs

# Start MongoDB service
# Windows: mongod --dbpath "C:\Program Files\MongoDB\Server\6.0\data"
# macOS: brew services start mongodb-community
# Linux: sudo systemctl start mongod

# Verify connection
mongosh
# Should show MongoDB shell prompt
```

### Option B: MongoDB Atlas (Cloud)

```bash
1. Visit https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create a cluster
4. Get connection string (looks like: mongodb+srv://user:pass@cluster.mongodb.net/db)
5. Add to .env: MONGODB_URI=<your_connection_string>
```

## Step 3: Python AI Service Setup (8 min)

```bash
# Navigate to Python service
cd python-ai-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
# This may take 3-5 minutes first time

# Run the service
python -m app.main

# Expected output:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# Press Ctrl+C to stop

# ✅ Leave running, open new terminal for next steps
```

## Step 4: Node.js Backend Setup (5 min)

```bash
# Open new terminal window/tab
# Navigate to Node backend
cd node-backend

# Install dependencies
npm install
# Takes 2-3 minutes first time

# Build TypeScript
npm run build

# Run the server
npm run dev

# Expected output:
# ✓ Node.js Backend running on port 5000
# ✓ Environment: development
# ✓ Python AI Service: localhost:8000

# ✅ Leave running, open new terminal for next steps
```

## Step 5: Electron App Setup (5 min)

```bash
# Open new terminal window/tab
# Navigate to Electron app
cd electron-app

# Install dependencies
npm install
# Takes 3-4 minutes first time

# Start development mode
npm run dev

# Expected output:
# Electron app window opens
# React dev server starts on http://localhost:3000
# App shows login screen

# ✅ Application is now running!
```

## Step 6: Test the System

### Verify All Services Running

```bash
# Check health endpoints in separate terminal
curl http://localhost:8000/health     # Python service
curl http://localhost:5000/health     # Node backend
# Both should return status: healthy
```

### Test Sign Up

1. Open Electron app
2. Click "Sign Up" 
3. Enter:
   - Username: `testuser`
   - Password: `password123`
   - Email: `test@example.com`
4. Click "Sign Up"
5. ✅ Should redirect to voice enrollment

### Test Voice Enrollment

1. Record 3 voice samples
2. Click "Start Recording Sample 1"
3. Speak clearly for 5-10 seconds
4. Click "Stop Recording"
5. Repeat for samples 2 and 3
6. ✅ Should automatically proceed to dashboard

### Test Voice Commands

1. Click "Start Listening"
2. Say: "Open Chrome"
3. ✅ Chrome should open and you hear "Opening Chrome"

## 🎯 Common Issues & Solutions

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

### MongoDB Connection Failed

```bash
# Verify MongoDB running
mongosh
# If error, start MongoDB service:
# Windows: net start MongoDB
# macOS: brew services start mongodb-community
# Linux: sudo systemctl start mongod
```

### Python Dependencies Failed

```bash
# Clear pip cache and reinstall
pip cache purge
rm -rf venv/
python -m venv venv
source venv/bin/activate  # or: venv\Scripts\activate
pip install -r requirements.txt
```

### Microphone Permission Denied

```
macOS: Settings → Privacy & Security → Microphone → Allow Electron
Windows: Settings → Privacy & Security → Microphone → Allow
Linux: Check pulseaudio/ALSA permissions
```

## 📊 Verify Everything Works

### Checklist

- [ ] Python service running on port 8000
- [ ] Node backend running on port 5000
- [ ] Electron app window opened
- [ ] Can sign up with new account
- [ ] Can enroll 3 voice samples
- [ ] Voice verification successful
- [ ] Can execute voice commands
- [ ] Commands logged in database

## 🚀 Next Steps

### Development

```bash
# Make changes in any service (hot-reload enabled)
# Edit .env for configuration changes
# Restart services if needed

# View logs
curl http://localhost:5000/api/logging/stats
curl http://localhost:5000/api/commands/history
```

### Production Build

```bash
# Build Electron for distribution
cd electron-app
npm run build

# Outputs to: dist/ and installers/
```

### Customize

- Edit UI: `electron-app/src/renderer/pages/`
- Add commands: `python-ai-service/app/services/command_service.py`
- System actions: `node-backend/src/services/systemService.ts`

## 💡 Pro Tips

1. **Keep terminals organized**: Use one terminal per service
2. **Monitor logs**: Use `npm run dev` for detailed output
3. **Test APIs**: Use curl or Postman to test endpoints
4. **Database**: Use MongoDB Compass for visual data management
5. **Debugging**: Check browser dev tools (F12) in Electron app

## 🆘 Still Having Issues?

1. **Check logs** in each terminal
2. **Verify ports** are not in use
3. **Check .env** configuration
4. **Ensure MongoDB** is running
5. **Review error messages** carefully
6. **Restart services** in order (Python → Node → Electron)

## 🎉 Success!

You now have a fully functional AI Assistant system running locally!

**Next**: Refer to main README.md for:
- Complete API documentation
- Security details
- Database schema
- Production deployment
- Advanced configuration

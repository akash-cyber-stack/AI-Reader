# Start AI Reader: Python AI (8000), Node backend (5000), Electron UI
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path "$Root\.env")) {
  Copy-Item "$Root\.env.example" "$Root\.env"
  Write-Host "Created .env from .env.example"
}

Write-Host "Starting Python AI service on port 8000..."
$pythonJob = Start-Process -FilePath "powershell" -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$Root\python-ai-service'; if (-not (Test-Path '.venv\Scripts\python.exe')) { python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt }; .\.venv\Scripts\python.exe -m app.main"
) -PassThru

Start-Sleep -Seconds 2

Write-Host "Starting Node.js backend on port 5000..."
$nodeJob = Start-Process -FilePath "powershell" -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$Root\node-backend'; npm run dev"
) -PassThru

Start-Sleep -Seconds 3

Write-Host "Starting Electron + React UI..."
Start-Process -FilePath "powershell" -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$Root\electron-app'; npm run dev"
)

Write-Host ""
Write-Host "AI Reader is starting in 3 windows:"
Write-Host "  1. Python  -> http://localhost:8000/health"
Write-Host "  2. Node    -> http://localhost:5000/health"
Write-Host "  3. Electron app (React on http://localhost:3000)"
Write-Host ""
Write-Host "Ensure MongoDB is running for login/voice enrollment."

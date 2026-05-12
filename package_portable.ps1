# PowerShell script to create a portable production build of Finance Tracker

$APP_NAME = "FinanceTracker_App"

Write-Host "-------------------------------------------------------" -ForegroundColor Cyan
Write-Host " Creating Portable Production Build: $APP_NAME" -ForegroundColor Cyan
Write-Host "-------------------------------------------------------" -ForegroundColor Cyan

# 1. Build components
Write-Host "Building Backend..." -ForegroundColor Yellow
npm run build

Write-Host "Building Frontend..." -ForegroundColor Yellow
Set-Location frontend
npm run build
Set-Location ..

# 2. Create folder structure
Write-Host "Creating folder structure..." -ForegroundColor Yellow
if (Test-Path $APP_NAME) { Remove-Item -Recurse -Force $APP_NAME }
New-Item -ItemType Directory -Path "$APP_NAME\backend\dist" -Force | Out-Null
New-Item -ItemType Directory -Path "$APP_NAME\frontend\dist" -Force | Out-Null
New-Item -ItemType Directory -Path "$APP_NAME\db" -Force | Out-Null

# 3. Copy files
Write-Host "Copying Backend files..." -ForegroundColor Yellow
Copy-Item -Path "dist\*" -Destination "$APP_NAME\backend\dist" -Recurse
Copy-Item -Path "package.json" -Destination "$APP_NAME\backend\"
Copy-Item -Path "package-lock.json" -Destination "$APP_NAME\backend\"
Copy-Item -Path "schema.sql" -Destination "$APP_NAME\"

Write-Host "Copying Frontend files..." -ForegroundColor Yellow
Copy-Item -Path "frontend\dist\*" -Destination "$APP_NAME\frontend\dist" -Recurse

# 4. Install production dependencies
Write-Host "Installing production dependencies in $APP_NAME\backend..." -ForegroundColor Yellow
Set-Location "$APP_NAME\backend"
npm install --production
Set-Location ..\..

# 5. Create helper scripts for the portable folder
Write-Host "Creating startup scripts in $APP_NAME..." -ForegroundColor Yellow

# Mac/Linux startup script
$shContent = @"
#!/bin/bash
echo "Starting Finance Tracker Production..."
# Bootstrap Database
node backend/dist/bootstrap_db.js
# Start Backend in background
node backend/dist/src/main.js &
# Start Frontend
npx serve -s frontend/dist -p 5173
"@
$shContent | Out-File -FilePath "$APP_NAME\start_app.sh" -Encoding ascii

# Windows startup script
$psContent = @"
Write-Host "Starting Finance Tracker Production..." -ForegroundColor Cyan
# Bootstrap Database
node backend/dist/bootstrap_db.js
# Start Backend
Start-Process -FilePath "node" -ArgumentList "backend/dist/src/main.js" -WindowStyle Normal
# Start Frontend
Start-Process -FilePath "npx.cmd" -ArgumentList "serve", "-s", "frontend/dist", "-p", "5173" -WindowStyle Normal
Write-Host "App is starting! Access it at http://localhost:5173" -ForegroundColor Green
"@
$psContent | Out-File -FilePath "$APP_NAME\start_app.ps1" -Encoding utf8

Write-Host "-------------------------------------------------------" -ForegroundColor Cyan
Write-Host " Done! Portable build is ready in: $APP_NAME" -ForegroundColor Green
Write-Host " Copy this folder to your new PC and run start_app.sh/.ps1" -ForegroundColor Cyan
Write-Host "-------------------------------------------------------" -ForegroundColor Cyan

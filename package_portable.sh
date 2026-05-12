#!/bin/bash
# Script to create a portable production build of Finance Tracker

APP_NAME="FinanceTracker_App"

echo "-------------------------------------------------------"
echo " Creating Portable Production Build: $APP_NAME"
echo "-------------------------------------------------------"

# 1. Build components
echo "Building Backend..."
npm run build

echo "Building Frontend..."
cd frontend
npm run build
cd ..

# 2. Create folder structure
echo "Creating folder structure..."
rm -rf $APP_NAME
mkdir -p $APP_NAME/backend/dist
mkdir -p $APP_NAME/frontend/dist
mkdir -p $APP_NAME/db

# 3. Copy files
echo "Copying Backend files..."
cp -r dist/* $APP_NAME/backend/dist/
cp package.json $APP_NAME/backend/
cp package-lock.json $APP_NAME/backend/
cp schema.sql $APP_NAME/

echo "Copying Frontend files..."
cp -r frontend/dist/* $APP_NAME/frontend/dist/

# 4. Install production dependencies

echo "Installing production dependencies in $APP_NAME/backend..."
cd $APP_NAME/backend
npm install --production
cd ../..

# 5. Create helper scripts for the portable folder
echo "Creating startup scripts in $APP_NAME..."

# Mac/Linux startup script
cat > $APP_NAME/start_app.sh <<EOL
#!/bin/bash
echo "Starting Finance Tracker Production..."
# Bootstrap Database
node backend/dist/bootstrap_db.js
# Start Backend in background
node backend/dist/src/main.js &
# Start Frontend
npx serve -s frontend/dist -p 5173
EOL
chmod +x $APP_NAME/start_app.sh

# Windows startup script
cat > $APP_NAME/start_app.ps1 <<EOL
Write-Host "Starting Finance Tracker Production..." -ForegroundColor Cyan
# Bootstrap Database
node backend/dist/bootstrap_db.js
# Start Backend
Start-Process -FilePath "node" -ArgumentList "backend/dist/src/main.js" -WindowStyle Normal
# Start Frontend
Start-Process -FilePath "npx.cmd" -ArgumentList "serve", "-s", "frontend/dist", "-p", "5173" -WindowStyle Normal
Write-Host "App is starting! Access it at http://localhost:5173" -ForegroundColor Green
EOL

echo "-------------------------------------------------------"
echo " Done! Portable build is ready in: $APP_NAME"
echo " Copy this folder to your new PC and run start_app.sh/.ps1"
echo "-------------------------------------------------------"

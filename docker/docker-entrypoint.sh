#!/bin/sh
set -e

# Run DB bootstrap script to initialize database if it doesn't exist
echo "Running database bootstrap checks..."
node dist/bootstrap_db.js

# Start NestJS backend app
echo "Starting NestJS API..."
exec node dist/src/main.js

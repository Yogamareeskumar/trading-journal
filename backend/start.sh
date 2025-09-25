#!/bin/bash

# Trading Journal API Start Script

echo "🚀 Starting Trading Journal API..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️ Node.js version 18 or higher is required. Current version: $(node -v)"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env file exists, if not create from example
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "⚠️ .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "🔧 Please update .env with your actual configuration values"
fi

# Set default port if not specified
export PORT=${PORT:-3001}

echo "🌍 Server will start on port $PORT"
echo "🔗 Health check: http://localhost:$PORT/api/health"

# Start the server
exec node server.js
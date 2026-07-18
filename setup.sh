#!/bin/bash

# MenRush - Quick Start Script

set -e

echo "🚀 MenRush - Location-Based Social Discovery Platform"
echo "=================================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install it first."
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ All prerequisites installed"
echo ""

# Create .env if doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env created (update with your values)"
fi

echo ""
echo "📦 Installing dependencies..."
cd frontend && npm install && cd ..
echo "✅ Frontend dependencies installed"

echo ""
echo "🐳 Starting Docker containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📍 Services running:"
echo "   - Backend API: http://localhost:3000"
echo "   - Frontend: http://localhost:5173"
echo "   - Database: localhost:5432"
echo ""
echo "🚀 Next steps:"
echo "   1. Frontend: cd frontend && npm run dev"
echo "   2. Open http://localhost:5173 in your browser"
echo "   3. Create an account and start exploring!"
echo ""
echo "📚 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"

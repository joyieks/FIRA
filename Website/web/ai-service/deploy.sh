#!/bin/bash

# FIRA AI Service Deployment Script
echo "🚀 Deploying FIRA AI Service..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create one based on .env.example"
    echo "Required variables:"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_KEY"
    exit 1
fi

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo "🔍 Checking service health..."
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ AI Service is running and healthy"
else
    echo "❌ AI Service health check failed"
    echo "Check logs with: docker-compose logs ai-service"
fi

echo "📊 Service status:"
docker-compose ps

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Services:"
echo "  - AI API: http://localhost:5000"
echo "  - Health Check: http://localhost:5000/health"
echo "  - Alarm Status: http://localhost:5000/alarm/status"
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop services: docker-compose down"
echo "  - Restart services: docker-compose restart"




























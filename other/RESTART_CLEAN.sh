#!/bin/bash

echo "🧹 Cleaning and restarting frontend..."

cd frontend

# Kill any running Next.js processes
pkill -f "next dev" 2>/dev/null || true

# Clean build cache
rm -rf .next
rm -rf node_modules/.cache

echo "✅ Cleaned!"
echo ""
echo "Starting fresh..."
npm run dev

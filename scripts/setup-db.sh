#!/bin/bash
set -e

echo "🔧 Setting up database..."

# Navigate to db package directory
cd "$(dirname "$0")/../packages/db"

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
bun run prisma:generate

# Deploy migrations
echo "🗃️  Running database migrations..."
bun run prisma:deploy

# Seed database
echo "🌱 Seeding database..."
bun run db:seed

echo "✅ Database setup complete!"

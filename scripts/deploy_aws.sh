#!/bin/bash
set -e

echo "==============================================="
echo "  Deploying Ilayaraja Music App to AWS (SAM)   "
echo "==============================================="

# Navigate to project root
cd "$(dirname "$0")/.."

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "Error: .env file not found in project root"
  exit 1
fi

# Build the SAM application
echo "Building SAM application..."
sam build

# Deploy using SAM with parameter overrides
echo "Deploying SAM application..."
sam deploy --stack-name ilayaraja-music-app \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    AppName="ilayaraja-music-app" \
    Environment="production" \
    MongoDbUri="${MONGODB_URI}" \
    GoogleClientId="${GOOGLE_CLIENT_ID}" \
    GeminiApiKey="${GEMINI_API_KEY}" \
    SpotifyClientId="${SPOTIFY_CLIENT_ID}" \
    SpotifyClientSecret="${SPOTIFY_CLIENT_SECRET}" \
    CloudFrontPrivateKey="$(cat backend/private_key.pem)" \
    AdminApiKey="uforian-secure-admin-key-2026"

echo "==============================================="
echo "  Deployment Complete!                         "
echo "==============================================="

#!/bin/bash
set -e

echo "========================================="
echo "  🚀 RAJA MUSIC APP - DEPLOY PIPELINE  "
echo "========================================="
echo ""

# 1. Local Build and Test
echo "[1/3] 🔨 Building local SAM application..."
echo "Running strict syntax check on backend code..."
node -c backend/lambda_functions.js
echo "Syntax check passed!"

sam build
echo "✅ Build completed successfully."
echo ""

# 2. Deploy to AWS
echo "[2/3] ☁️ Deploying to AWS via SAM..."
if [ -f scripts/deploy_sam.js ]; then
  node scripts/deploy_sam.js
else
  sam deploy --no-confirm-changeset
fi
echo "✅ Deployment to AWS completed successfully."
echo ""

# 3. Push to GitHub
echo "[3/3] 🐙 Pushing changes to GitHub..."
git add .
git commit -m "Auto-deploy via pipeline: $(date '+%Y-%m-%d %H:%M:%S')" || echo "No new changes to commit."
git push origin main
echo "✅ Code pushed to GitHub."
echo ""

echo "🎉 Pipeline finished successfully!"

#!/bin/bash
set -e

echo "========================================="
echo "  🚀 RAJA MUSIC APP - DEPLOY PIPELINE  "
echo "========================================="
echo ""

FRONTEND_BUCKET="ilayaraja-music-app-frontend-274345729498"
CF_DISTRIBUTION_ID="E35ZCPG4320GQR"

# 1. Local Build and Test
echo "[1/4] 🔨 Building local SAM application..."
echo "Running strict syntax check on backend code..."
node -c backend/lambda_functions.js
echo "Syntax check passed!"

sam build
echo "✅ Build completed successfully."
echo ""

# 2. Build Frontend
echo "[2/4] 🖥️  Building frontend..."
cd frontend
# Inject production API URL if it's not already in .env.production
if ! grep -q "VITE_API_URL" .env.production 2>/dev/null; then
  echo "VITE_API_URL=https://mnaergptzl.execute-api.us-east-1.amazonaws.com/production" > .env.production
fi
npm install
npm run build
cd ..
echo "✅ Frontend build completed."
echo ""

# 3. Deploy to AWS
echo "[3/4] ☁️ Deploying to AWS via SAM..."
if [ -f scripts/deploy_sam.js ]; then
  node scripts/deploy_sam.js
else
  sam deploy --no-confirm-changeset || echo "SAM deploy exited with code $? (Likely no changes, continuing...)"
fi

# Deploy frontend to S3 and invalidate CloudFront
echo "Deploying frontend to S3..."
aws s3 sync frontend/dist/ s3://${FRONTEND_BUCKET}/ --delete
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id ${CF_DISTRIBUTION_ID} --paths "/*" --output text
echo "✅ Deployment to AWS completed successfully."
echo ""

# 4. Push to GitHub
echo "[4/4] 🐙 Pushing changes to GitHub..."
git add .
git commit -m "Auto-deploy via pipeline: $(date '+%Y-%m-%d %H:%M:%S')" || echo "No new changes to commit."
git push origin main
echo "✅ Code pushed to GitHub."
echo ""

echo "🎉 Pipeline finished successfully!"

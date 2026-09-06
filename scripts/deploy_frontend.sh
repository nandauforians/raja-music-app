#!/bin/bash
set -e

echo "==============================================="
echo "  Deploying Frontend to S3                     "
echo "==============================================="

cd "$(dirname "$0")/../frontend"
echo "Building frontend..."
npm run build

BUCKET_NAME="ilayaraja-music-app-frontend-274345729498"
echo "Syncing to S3 bucket: $BUCKET_NAME"
aws s3 sync dist/ s3://$BUCKET_NAME/ --delete

DISTRIBUTION_ID="E35ZCPG4320GQR"
echo "Invalidating CloudFront cache for distribution $DISTRIBUTION_ID..."
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

echo "Frontend Deployment Complete!"

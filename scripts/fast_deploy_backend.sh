#!/bin/bash
set -e

echo "==============================================="
echo "  Fast Deploying Backend to AWS Lambdas        "
echo "==============================================="

# Navigate to project root
cd "$(dirname "$0")/.."

echo "Running strict syntax checks on backend..."
node -c backend/lambda_functions.js
node -c backend/handlers/admin.js
node -c backend/handlers/songs.js
echo "Syntax checks passed!"

S3_BUCKET="aws-sam-cli-managed-default-samclisourcebucket-lq2v304r9wgr"
ZIP_KEY="fast-deploy/backend-$(date +%s).zip"

echo "Zipping backend directory..."
cd backend
rm -f ../backend.zip
zip -rq ../backend.zip .
cd ..

echo "Uploading zip once to S3 ($S3_BUCKET)..."
aws s3 cp backend.zip "s3://${S3_BUCKET}/${ZIP_KEY}" --region us-east-1

echo "Fetching Lambda functions for ilayaraja-app stack..."
FUNCTIONS=$(aws cloudformation list-stack-resources \
    --stack-name ilayaraja-app \
    --region us-east-1 \
    --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId" \
    --output text)

FUNC_COUNT=$(echo "$FUNCTIONS" | wc -w)
echo "Found $FUNC_COUNT functions to update from S3 in parallel..."

for FUNC in $FUNCTIONS; do
    echo "Updating $FUNC..."
    aws lambda update-function-code \
        --function-name "$FUNC" \
        --s3-bucket "$S3_BUCKET" \
        --s3-key "$ZIP_KEY" \
        --region us-east-1 >/dev/null 2>&1 &
done

# Wait for all background updates to finish
wait

echo "Cleaning up local zip..."
rm -f backend.zip

echo "==============================================="
echo "  Fast Deployment Complete!                    "
echo "==============================================="

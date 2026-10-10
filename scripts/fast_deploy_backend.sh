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

echo "Zipping backend directory..."
cd backend
rm -f ../backend.zip
zip -rq ../backend.zip .
cd ..

echo "Fetching Lambda functions for ilayaraja-app stack..."
# Fetch all PhysicalResourceIds for AWS::Lambda::Function resources in the stack
FUNCTIONS=$(aws cloudformation list-stack-resources \
    --stack-name ilayaraja-app \
    --region us-east-1 \
    --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId" \
    --output text)

FUNC_COUNT=$(echo "$FUNCTIONS" | wc -w)
echo "Found $FUNC_COUNT functions to update."
echo "Updating functions in parallel..."

for FUNC in $FUNCTIONS; do
    echo "Updating $FUNC..."
    aws lambda update-function-code \
        --function-name "$FUNC" \
        --zip-file fileb://backend.zip \
        --region us-east-1 >/dev/null 2>&1 &
done

# Wait for all background updates to finish
wait

echo "Cleaning up..."
rm -f backend.zip

echo "==============================================="
echo "  Fast Deployment Complete!                    "
echo "==============================================="

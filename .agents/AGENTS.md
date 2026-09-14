# Project-Specific Rules

## Deployment Safety Check
Before deploying or uploading code to AWS (e.g., executing `deploy_aws.sh` or `sam deploy`), you MUST perform a strict syntax check on the backend code. Run tools like `node -c backend/lambda_functions.js` or start the local server briefly to verify that there are no syntax errors or immediate crashes. Do not proceed with the AWS deployment if these checks fail.

## CloudFormation Stack Safety (CRITICAL)
Due to a historic stack rename, there are TWO AWS CloudFormation stacks for this project:
1. `ilayaraja-music-app` (The OLD stack)
2. `ilayaraja-app` (The NEW production backend stack)

**DO NOT DELETE the old `ilayaraja-music-app` stack via CloudFormation.** 
Although the old API Gateway and Lambdas are abandoned, this old stack exclusively owns and manages the **production Frontend S3 Bucket** and the **CloudFront Distribution**. Deleting the old stack will permanently destroy the live website's infrastructure. Any cleanup of old backend resources must be done manually via the AWS API Gateway and Lambda consoles, never via CloudFormation stack deletion.

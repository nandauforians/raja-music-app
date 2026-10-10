# Project-Specific Rules

## Deployment Safety Check
Before deploying or uploading code to AWS (e.g., executing `deploy_aws.sh` or `sam deploy`), you MUST perform a strict syntax check on the backend code. Run tools like `node -c backend/lambda_functions.js` or start the local server briefly to verify that there are no syntax errors or immediate crashes. Do not proceed with the AWS deployment if these checks fail.

## CloudFormation Stack Safety (CRITICAL)
Due to a historic stack rename, there are TWO AWS CloudFormation stacks for this project:
1. `ilayaraja-music-app` (The OLD stack)
2. `ilayaraja-app` (The NEW production backend stack)

**DO NOT DELETE the old `ilayaraja-music-app` stack via CloudFormation.** 
Although the old API Gateway and Lambdas are abandoned, this old stack exclusively owns and manages the **production Frontend S3 Bucket** and the **CloudFront Distribution**. Deleting the old stack will permanently destroy the live website's infrastructure. Any cleanup of old backend resources must be done manually via the AWS API Gateway and Lambda consoles, never via CloudFormation stack deletion.

## Backend Deployment Workflow (CRITICAL)
Due to the structure of `template.yaml` (which points all 45+ Lambdas to the same `backend/` directory), `sam build` and `sam deploy` will sequentially re-zip the entire 170MB directory for *each* Lambda function, taking 25+ minutes.
To avoid this bottleneck:
1. **For Code-Only Updates** (e.g. modifying handlers, logic, adding features to existing routes): **ALWAYS** use `./scripts/fast_deploy_backend.sh`. This script bypasses CloudFormation entirely, zips the code once, and updates all Lambda code in parallel using the AWS SDK in ~15 seconds.
2. **For Infrastructure Updates** (e.g. adding new API Gateway routes or creating brand new Lambda functions in `template.yaml`): You must use SAM, but bypass the build step. Run `sam package --template-file template.yaml --s3-bucket aws-sam-cli-managed-default-samclisourcebucket-lq2v304r9wgr --output-template-file packaged.yaml` and then deploy with `sam deploy --template-file packaged.yaml --stack-name ilayaraja-app --capabilities CAPABILITY_IAM --no-confirm-changeset`. Do NOT use `sam build` locally.

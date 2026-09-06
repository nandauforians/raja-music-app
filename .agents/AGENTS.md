# Project-Specific Rules

## Deployment Safety Check
Before deploying or uploading code to AWS (e.g., executing `deploy_aws.sh` or `sam deploy`), you MUST perform a strict syntax check on the backend code. Run tools like `node -c backend/lambda_functions.js` or start the local server briefly to verify that there are no syntax errors or immediate crashes. Do not proceed with the AWS deployment if these checks fail.

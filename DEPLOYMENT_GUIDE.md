# 🚀 ILAYARAJA DAILY MUSIC APP - DEPLOYMENT GUIDE

Complete, step-by-step instructions to deploy your serverless music app to AWS.

---

## 📋 PRE-DEPLOYMENT CHECKLIST

- [ ] AWS Account created
- [ ] AWS CLI installed (`aws --version`)
- [ ] SAM CLI installed (`sam --version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Git installed (`git --version`)
- [ ] Spotify developer app created (get credentials)
- [ ] Domain name registered (or use CloudFront domain)
- [ ] Admin API key generated (any random string)

---

## 🔧 STEP 1: SETUP AWS CREDENTIALS

```bash
# Configure AWS CLI with your credentials
aws configure

# When prompted, enter:
# AWS Access Key ID: [your_access_key]
# AWS Secret Access Key: [your_secret_key]
# Default region: us-east-1
# Default output format: json

# Verify connection
aws sts get-caller-identity
```

**Output should show your AWS account ID:**
```json
{
  "UserId": "AIDAI...",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/your-user"
}
```

---

## 📦 STEP 2: CLONE/CREATE PROJECT STRUCTURE

```bash
# Create project directory
mkdir ilayaraja-daily
cd ilayaraja-daily

# Create subdirectories
mkdir -p frontend backend data

# Download/create files:
# - frontend/ (React app)
# - backend/ (Lambda functions)
# - data/ (song database)
# - template.yaml (SAM template)
# - .env.example
```

**File structure after setup:**
```
ilayaraja-daily/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── lambda_functions.js
│   ├── package.json
│   └── .env
├── data/
│   ├── ilayaraja_songs_database.json
│   └── initial_schedule.json
├── template.yaml
├── .env.example
├── README.md
└── .gitignore
```

---

## 🔑 STEP 3: CONFIGURE ENVIRONMENT VARIABLES

### Create `.env` file in project root:

```bash
cat > .env << 'EOF'
# AWS
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012  # Your AWS account ID

# Application
APP_NAME=ilayaraja-app
ENVIRONMENT=production

# Admin Security
ADMIN_API_KEY=your_super_secret_key_12345  # Generate a strong random string

# Spotify
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret  # Keep secret!

# Domain
DOMAIN_NAME=ilayaraja-daily.com

# Frontend
VITE_API_ENDPOINT=https://your-api-domain.execute-api.us-east-1.amazonaws.com/production
EOF

# Keep .env secure (add to .gitignore)
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

**To get Spotify credentials:**
1. Go to https://developer.spotify.com/dashboard
2. Create a new app
3. Accept terms and create
4. Copy `Client ID` and `Client Secret`
5. Add redirect URI: `https://your-domain/callback`

---

## 📦 STEP 4: INSTALL DEPENDENCIES

### Backend:
```bash
cd backend
npm init -y
npm install aws-sdk

# Optional: Layer for shared dependencies
npm install --save-dev webpack webpack-cli
```

### Frontend:
```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install react-icons axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Root (deployment scripts):
```bash
cd ..
npm init -y
npm install --save-dev aws-cli
```

---

## 🏗️ STEP 5: BUILD FRONTEND

```bash
cd frontend

# Build production bundle
npm run build

# Output: dist/ folder ready for S3

# Test locally (optional)
npm run preview
```

**Expected output:**
```
vite v4.x.x building for production...
✓ x modules transformed
dist/index.html           2.4 kb
dist/assets/main.xxxxx.js 45.2 kb
dist/assets/style.xxxxx.css 8.4 kb
```

---

## ☁️ STEP 6: DEPLOY INFRASTRUCTURE WITH SAM

```bash
cd /path/to/ilayaraja-daily

# Build SAM template
sam build

# Deploy (interactive mode)
sam deploy --guided

# When prompted, enter:
# Stack name: ilayaraja-app
# Region: us-east-1
# Admin API key: [your_secret_key]
# Domain name: ilayaraja-daily.com
# Confirm changes: Y
# Allow SAM to create IAM roles: Y
# Allow SAM to create S3 bucket: Y
# Allow SAM to create CloudFormation: Y
```

**This creates:**
- API Gateway (REST endpoints)
- 7 Lambda functions
- 2 DynamoDB tables
- S3 bucket for frontend
- CloudFront distribution
- CloudWatch log groups
- IAM roles

**Deployment takes 5-10 minutes. Output example:**
```
CloudFormation outputs from deployed stack

Key                  Value
-------------------  ---------------------------
ApiEndpoint          https://abc123.execute-api...
FrontendBucketName   ilayaraja-app-frontend-xxx
CloudFrontDomain     d123abc.cloudfront.net
SongScheduleTableName ilayaraja-app-schedule
```

---

## 📤 STEP 7: DEPLOY FRONTEND TO S3

```bash
# Get bucket name from SAM output
BUCKET_NAME="ilayaraja-app-frontend-123456789012"
CLOUDFRONT_ID="d123abc"  # From SAM output

# Copy frontend build to S3
aws s3 sync frontend/dist/ s3://$BUCKET_NAME/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*"

# Show result
aws s3 ls s3://$BUCKET_NAME/ --recursive
```

**Verification:**
```bash
# Test S3 access
curl -I https://$CLOUDFRONT_ID.cloudfront.net

# Should return: HTTP/1.1 200 OK
```

---

## 🎵 STEP 8: SEED SONG DATABASE

```bash
# Get API endpoint from SAM output
API_ENDPOINT="https://abc123.execute-api.us-east-1.amazonaws.com/production"
ADMIN_KEY="your_super_secret_key_12345"

# Seed database with songs
curl -X POST $API_ENDPOINT/seed \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d @data/ilayaraja_songs_database.json

# Response should be:
# { "success": true, "message": "Seeded 102 songs to database" }
```

**Verify data:**
```bash
# List all songs
curl -X GET "$API_ENDPOINT/songs/list?page=0" \
  -H "Authorization: Bearer $ADMIN_KEY"

# Get today's song
curl -X GET "$API_ENDPOINT/song/today"
```

---

## 🔗 STEP 9: SETUP DOMAIN (OPTIONAL)

### Using Route 53 (AWS-hosted domain):

```bash
# List your hosted zones
aws route53 list-hosted-zones

# Create CNAME record pointing to CloudFront
# Go to AWS Route 53 → Your domain → Create record
# Type: CNAME
# Name: ilayaraja-daily.com
# Value: d123abc.cloudfront.net (your CloudFront domain)
# TTL: 300

# Add certificate for HTTPS
aws acm request-certificate \
  --domain-name ilayaraja-daily.com \
  --validation-method DNS
```

### Using external registrar (GoDaddy, Namecheap, etc.):

1. Get CloudFront domain from SAM output: `d123abc.cloudfront.net`
2. Log into your registrar
3. Add CNAME record:
   - Name: `ilayaraja-daily.com`
   - Value: `d123abc.cloudfront.net`
4. Wait for DNS propagation (15-60 minutes)
5. Test: `curl https://ilayaraja-daily.com`

---

## ✅ STEP 10: VERIFY DEPLOYMENT

```bash
# Test API endpoints
ENDPOINT="https://abc123.execute-api.us-east-1.amazonaws.com/production"

# 1. Health check
curl $ENDPOINT/health
# Expected: { "success": true, "status": "healthy" }

# 2. Get today's song
curl $ENDPOINT/song/today
# Expected: { "success": true, "song": {...}, "source": "scheduled|random" }

# 3. Get song list (requires auth)
curl $ENDPOINT/songs/list \
  -H "Authorization: Bearer $ADMIN_API_KEY"

# 4. Schedule a song
curl -X POST $ENDPOINT/admin/schedule \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dateISO8601": "2025-02-20",
    "song_id": "1",
    "title": "Uyarnthu Ularpadi",
    "movie": "Padayottam",
    "year": 1982,
    "spotify_id": "7qiZfU4dY1lsylvNHdwA1x"
  }'

# 5. List upcoming schedule
curl $ENDPOINT/admin/schedule?month=2025-02 \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

---

## 📊 STEP 11: MONITOR & LOGGING

### View CloudWatch Logs:

```bash
# Get Lambda logs
aws logs tail /aws/lambda/ilayaraja-app-get-song-of-day --follow

# Get API Gateway logs
aws logs tail /aws/apigateway/ilayaraja-app --follow

# Get last 100 lines without following
aws logs tail /aws/lambda/ilayaraja-app-get-song-of-day --max-items 100
```

### CloudWatch Dashboard:

```bash
# Create dashboard (optional)
aws cloudwatch put-dashboard \
  --dashboard-name ilayaraja-app \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "metrics": [
            ["AWS/Lambda", "Invocations", {"stat": "Sum"}],
            ["AWS/Lambda", "Errors", {"stat": "Sum"}],
            ["AWS/Lambda", "Duration", {"stat": "Average"}]
          ],
          "period": 300,
          "stat": "Average",
          "region": "us-east-1",
          "title": "Lambda Metrics"
        }
      }
    ]
  }'

# Open in AWS Console:
# https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:
```

---

## 💰 STEP 12: MONITOR COSTS

```bash
# View estimated costs
aws ce get-cost-and-usage \
  --time-period Start=2025-02-01,End=2025-02-28 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Expected monthly costs:
# - Lambda: $0 (free tier covers 1M invocations)
# - DynamoDB: ~$1-5 (pay-per-request)
# - CloudFront: ~$0.85 (first 1TB free)
# - S3: <$1 (storage + transfer)
# - Total: $2-7/month (very cheap!)
```

---

## 🔄 STEP 13: SETUP CI/CD (GITHUB ACTIONS)

### Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Ilayaraja App

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build Frontend
        run: |
          cd frontend
          npm ci
          npm run build
      
      - name: Deploy to S3
        run: |
          aws s3 sync frontend/dist/ s3://${{ secrets.FRONTEND_BUCKET }}/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: us-east-1
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }} \
            --paths "/*"
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: us-east-1
```

### Add GitHub Secrets:
1. Go to repo → Settings → Secrets and variables → Actions
2. Add:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `FRONTEND_BUCKET` (from SAM output)
   - `CLOUDFRONT_DIST_ID` (from SAM output)

---

## 🚨 TROUBLESHOOTING

### Lambda returns 502 Bad Gateway
```bash
# Check Lambda logs for errors
aws logs tail /aws/lambda/ilayaraja-app-get-song-of-day --follow

# Common causes:
# - Invalid DynamoDB table name
# - Missing IAM permissions
# - Environment variables not set
# - JSON parsing error in request body
```

### S3/CloudFront returns 403 Forbidden
```bash
# Check bucket permissions
aws s3api get-bucket-policy --bucket $BUCKET_NAME

# Check OAI is correctly configured
aws cloudfront get-distribution --id $CLOUDFRONT_ID | grep OriginAccessIdentity

# Re-sync files
aws s3 sync frontend/dist/ s3://$BUCKET_NAME/ --delete --acl public-read
```

### DynamoDB throttling
```bash
# Check consumed capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=ilayaraja-app-songs \
  --start-time 2025-02-01T00:00:00Z \
  --end-time 2025-02-28T00:00:00Z \
  --period 3600 \
  --statistics Sum

# Increase capacity (if needed)
aws dynamodb update-table \
  --table-name ilayaraja-app-songs \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```

### CORS errors
```bash
# Check API Gateway CORS settings
aws apigateway get-rest-apis --query 'items[?name==`ilayaraja-app-api`]'

# Verify CORS headers in Lambda response (check lambda_functions.js)
# corsHeaders should include:
# - Access-Control-Allow-Origin: https://ilayaraja-daily.com
# - Access-Control-Allow-Methods: GET,POST,OPTIONS
# - Access-Control-Allow-Headers: Content-Type,Authorization
```

---

## 🔐 SECURITY BEST PRACTICES

```bash
# 1. Rotate admin API key monthly
NEW_KEY=$(openssl rand -base64 32)
echo "New API key: $NEW_KEY"

# 2. Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name ilayaraja-app-get-song-of-day \
  --environment Variables={ADMIN_API_KEY=$NEW_KEY}

# 3. Enable AWS Config monitoring
aws configservice put-config-rule \
  --config-rule Name=dynamodb-encryption-enabled

# 4. Enable CloudTrail logging
aws cloudtrail start-logging --trail-name ilayaraja-app-trail

# 5. Set S3 bucket encryption
aws s3api put-bucket-encryption \
  --bucket $BUCKET_NAME \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}
    }]
  }'
```

---

## 📈 MAINTENANCE & SCALING

### Weekly Tasks
- [ ] Review CloudWatch logs for errors
- [ ] Check Lambda cold start times
- [ ] Verify admin API is working

### Monthly Tasks
- [ ] Review cost report
- [ ] Backup DynamoDB (automatic with PITR)
- [ ] Update song database
- [ ] Curate next month's schedule

### Quarterly Tasks
- [ ] Security audit (check IAM roles)
- [ ] Review and update Lambda timeout settings
- [ ] Test disaster recovery (restore from backup)
- [ ] Update dependencies (npm audit)

### Auto-Scaling for Growth

```bash
# If hitting rate limits, enable auto-scaling:

# For DynamoDB (if switched to provisioned mode)
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/ilayaraja-app-songs \
  --scalable-dimension dynamodb:table:WriteCapacityUnits \
  --min-capacity 5 \
  --max-capacity 100

# For Lambda Reserved Concurrency
aws lambda put-function-concurrency \
  --function-name ilayaraja-app-get-song-of-day \
  --reserved-concurrent-executions 100
```

---

## 🎉 LAUNCH CHECKLIST

- [ ] Frontend deployed to S3 + CloudFront
- [ ] Lambda functions running without errors
- [ ] DynamoDB tables populated with songs
- [ ] Admin API key set and secure
- [ ] Domain name configured and HTTPS working
- [ ] CloudWatch alarms created
- [ ] Logging verified
- [ ] Cost monitoring enabled
- [ ] Backup and disaster recovery tested
- [ ] CI/CD pipeline working
- [ ] Team trained on admin panel
- [ ] Launch announcement ready!

---

## 📞 SUPPORT RESOURCES

- **AWS Documentation:** https://docs.aws.amazon.com/
- **SAM Documentation:** https://docs.aws.amazon.com/serverless-application-model/
- **Lambda Developer Guide:** https://docs.aws.amazon.com/lambda/
- **DynamoDB Best Practices:** https://docs.aws.amazon.com/amazondynamodb/
- **CloudFront Documentation:** https://docs.aws.amazon.com/cloudfront/

---

## 🎯 NEXT STEPS AFTER LAUNCH

1. **Monitor First Week:** Watch for errors, unusual traffic patterns
2. **Gather Feedback:** Get user reactions, technical feedback
3. **Optimize:** Based on metrics, optimize Lambda timeout, memory, etc.
4. **Expand:** Add more features (favorites, playlists, sharing)
5. **Marketing:** Share with Ilayaraja fans, music communities

---

**Deployment completed! 🚀 Your Ilayaraja Daily Music app is now live!**

For questions or issues, refer to the troubleshooting section or AWS documentation.

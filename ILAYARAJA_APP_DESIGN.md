# 🎵 Ilayaraja Daily Music Discovery App
## Complete Technical Architecture & Design Document

---

## 1. PROJECT OVERVIEW

A beautiful, scalable web application that showcases one Ilayaraja song per day. The song changes daily, with admin control over scheduling. Deployed on AWS S3 with serverless backend for infinite scalability.

**Key Features:**
- One curated Ilayaraja song per day
- Beautiful, responsive UI
- Admin dashboard to schedule songs
- Embedded Spotify player
- Zero maintenance infrastructure
- Fully serverless & scalable

---

## 2. TECHNOLOGY STACK

### Frontend
- **Framework:** React 18 + Vite (fast build, HMR)
- **Styling:** Tailwind CSS + custom CSS variables
- **Player:** Spotify Web API (embedded player)
- **State Management:** React Hooks (Context for simple state)
- **Hosting:** AWS S3 + CloudFront (CDN)

### Backend
- **Runtime:** AWS Lambda (Node.js 18+)
- **API:** AWS API Gateway (REST)
- **Database:** AWS DynamoDB (pay-per-request)
- **Song Source:** Spotify Web API (for player embeds & metadata)
- **Storage:** S3 (backup song list, admin data)

### Infrastructure as Code
- **IaC:** AWS CloudFormation or Terraform (for reproducibility)
- **CI/CD:** GitHub Actions → deploy to S3 on push

### Why This Stack?
- **Serverless:** No servers to manage, scales to millions of users automatically
- **Cost:** Free tier covers small usage; pay-as-you-go after
- **Reliability:** 99.99% uptime SLA from AWS
- **Fast:** CDN delivers UI globally, Lambda cold starts <1s
- **Maintainable:** Infrastructure as code, repeatable deployments

---

## 3. ARCHITECTURE DETAILS

### 3.1 Frontend Architecture

**Directory Structure:**
```
ilayaraja-app/
├── src/
│   ├── components/
│   │   ├── DailySongCard.jsx
│   │   ├── Player.jsx
│   │   ├── AdminPanel.jsx
│   │   └── Navbar.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   └── Admin.jsx
│   ├── hooks/
│   │   ├── useSongOfDay.js
│   │   └── useAdmin.js
│   ├── api/
│   │   └── client.js (API calls to Lambda)
│   ├── styles/
│   │   ├── global.css
│   │   └── themes.css
│   └── App.jsx
├── public/
│   └── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

**Key Components:**

1. **DailySongCard** - Displays today's song with artwork, metadata
2. **Player** - Spotify embedded player iframe
3. **AdminPanel** - Schedule future songs, manage list
4. **Navbar** - Navigation, theme toggle, admin login

**State Management:**
- Use `useContext` for global song state
- LocalStorage for user preferences (favorites, theme)
- React Query for API calls (optional, for caching)

### 3.2 Backend Architecture

**Core Philosophy:** 
The backend must remain strictly modular to prevent logic leakage and maintain readability. The monolithic structure has been deprecated. We use a **Proxy Router** pattern.

**Directory Structure:**
```
backend/
├── lambda_functions.js (The Proxy Router - NO LOGIC HERE)
├── utils/
│   ├── db.js (MongoDB connection pooling/caching)
│   ├── auth.js (Token validation)
│   ├── s3.js (File uploads/presigned URLs)
│   └── responses.js (CORS headers)
├── handlers/
│   ├── admin.js
│   ├── songs.js
│   ├── users.js
│   ├── karaoke.js
│   ├── schedule.js
│   ├── social.js
│   └── suggestions.js
└── __tests__/
    └── lambda_functions.test.js
```

**Development Standards (CRITICAL):**
1. **The Proxy Router (`lambda_functions.js`)**: This file must ONLY import handlers and export them via object spread (`...songs`, `...users`). **NEVER** write business logic, database queries, or helper functions in this file. It exists solely because AWS SAM `template.yaml` is statically bound to `lambda_functions.handlerName`.
2. **Domain Handlers**: New API endpoints must be placed inside the appropriate domain file in `backend/handlers/`. If a new domain is introduced (e.g., `notifications`), create a new handler file and add it to the proxy router.
3. **Database Caching**: Always use `const { getDb } = require('../utils/db');`. The `getDb()` function handles connection pooling and caches the MongoClient globally (`global.__MONGO_CACHED_CLIENT__`) to ensure AWS Lambda and Vitest compatibility.
4. **Testing**: All logic must be strictly unit tested locally via `npm test` before deployment.
5. **Syntax Checks**: Before executing `pipeline.sh`, run `node -c backend/lambda_functions.js` and `node -c backend/handlers/*.js`.

**Key Lambda Functions (Examples):**

1. **`getSongOfDay`** (in `handlers/songs.js`)
   - Triggered by: HTTP GET `/song/today`
   - Logic: Query MongoDB for today's date → return song + Gemini Trivia

2. **`scheduleSong`** (in `handlers/schedule.js`)
   - Triggered by: HTTP POST `/admin/schedule` (authenticated)
   - Validates: Admin token via AWS Cognito or `auth.js`

3. **`listSchedule`** (in `handlers/schedule.js`)
   - GET `/admin/schedule?month=2025-02`

4. **`getSongList`** (in `handlers/songs.js`)
   - GET `/songs/list?page=1`

**API Endpoints:**
```
GET  /song/today              → Today's song
GET  /songs/list              → All songs (paginated)
POST /admin/schedule          → Schedule a song (protected)
GET  /admin/schedule          → View schedule (protected)
POST /admin/reset-schedule    → Clear and regenerate (protected)
GET  /health                  → Health check
```

**Authentication:**
- Use AWS Cognito for admin login (optional but recommended)
- Alternatively: API key in headers + hardcoded in frontend
- Environment variables for secrets (never commit)

### 3.3 Database Schema (DynamoDB)

**Table 1: `IlayarajaSongSchedule`**
```
PrimaryKey: DateISO8601 (String) - e.g., "2025-02-15"
Attributes:
  - song_id (String): Spotify track ID
  - title (String): Song title
  - movie (String): Film name
  - year (Number): Release year
  - spotify_url (String): Open URL
  - artist (String): "Ilayaraja" (constant)
  - TTL (Number): Optional expiry (archive old entries)
```

**Table 2: `IlayarajaSongMaster` (Optional backup)**
```
PrimaryKey: song_id (String)
Attributes:
  - title, movie, year, spotify_id
  - youtube_id (String): YouTube link as backup
  - lyrics_snippet (String): First 50 chars
  - rating (Number): Community rating
```

**Indexes:**
- GSI on `movie` to find all songs from a film
- GSI on `year` to find songs by decade

### 3.4 Data Flow

**User Visit:**
1. User opens `ilayaraja-daily.com`
2. Frontend loads from S3 (cached by CloudFront)
3. React mounts, calls `GET /song/today` via API Gateway → Lambda
4. Lambda queries DynamoDB for today's date
5. If found: return song
6. If not found: pick from random rotation or scheduled
7. Frontend renders DailySongCard + Spotify player
8. User can play directly via Spotify embed

**Admin Scheduling:**
1. Admin logs in (Cognito or API key)
2. Opens `/admin` page
3. Views calendar with scheduled/unscheduled dates
4. Clicks a date, selects song from curated list
5. Clicks "Schedule" → `POST /admin/schedule`
6. Lambda validates token, stores in DynamoDB
7. Confirmation toast, calendar updates
8. Frontend auto-refreshes upcoming songs

### 3.5 Deployment Strategy

**Frontend Deployment (S3 + CloudFront):**
```bash
# Build React app
npm run build  # Outputs to dist/

# Deploy to S3
aws s3 sync dist/ s3://ilayaraja-app-bucket/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

**Backend Deployment (Lambda):**
```bash
# Package Lambda functions
zip -r lambda.zip src/lambda/

# Deploy via AWS CLI or SAM
sam deploy --guided  # Interactive deployment
```

**CI/CD with GitHub Actions:**
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
      
      - name: Build React App
        run: npm ci && npm run build
      
      - name: Deploy to S3
        run: aws s3 sync dist/ s3://ilayaraja-app-bucket/ --delete
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      
      - name: Invalidate CloudFront
        run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }} --paths "/*"
```

---

## 4. SONG MANAGEMENT STRATEGY

### 4.1 Song List Maintenance

**Source of Truth:** DynamoDB `IlayarajaSongMaster` table + backup JSON in S3

**Workflow:**
1. **Curate Songs:** Use `songs.json` file in repo (version controlled)
2. **Load to DynamoDB:** Lambda function to seed from JSON
3. **Admin UI:** Provides search/filter over all 100+ songs
4. **Scheduled Rotation:** Admin pre-fills dates, or auto-pick random

**Weekly Curation Process:**
- Music curator reviews top 5 songs to feature
- Updates `songs.json` with new additions/metadata
- Commits to GitHub (tracked changes)
- CI/CD auto-syncs to DynamoDB
- Admin dashboard shows "Next Week's Picks"

**Backup Strategy:**
- S3 versioning for `songs.json`
- DynamoDB point-in-time recovery (1 month retention)
- Export schedule table monthly to S3 archive

### 4.2 Random vs. Scheduled

**Two Modes:**

**Mode 1: Pre-Scheduled (Recommended)**
- Admin plans 30-90 days in advance
- Higher quality curation
- Predictable user experience
- Easier to theme (e.g., "February: Romantic Songs")

**Mode 2: Auto-Random (Fallback)**
- If no date entry exists, pick random from master list
- Weighted by rating (popular songs appear more)
- Never repeats in 30 days
- Good for initial launch before schedule is ready

**Hybrid Approach (Best):**
- 60-80% pre-scheduled by admin
- 20-40% auto-random to add discovery
- Algorithm: `if (dateInDynamoDB) use it, else pick random`

### 4.3 Song Rotation Algorithm

```javascript
// Prevent repeats algorithm
function pickRandomSong(masterList, lastNSongs, dayOfYear) {
  // Filter out songs from last 30 days
  const available = masterList.filter(s => !lastNSongs.includes(s.id));
  
  // Weight by rating (1-10)
  const weighted = available.sort((a, b) => b.rating - a.rating);
  
  // Seed by dayOfYear (deterministic randomness)
  const seed = dayOfYear * 12345;
  const randomIndex = (seed % weighted.length);
  
  return weighted[randomIndex];
}
```

---

## 5. SPOTIFY INTEGRATION

### 5.1 Why Spotify?
- ✅ Free embedded player (no account needed to listen)
- ✅ Official, high-quality streams
- ✅ Metadata API (artist, album, image)
- ✅ Shareable links
- ✅ Cross-platform (web, mobile, desktop)

### 5.2 Setup

**Create Spotify App:**
1. Go to https://developer.spotify.com/dashboard
2. Create app → get `Client ID` and `Client Secret`
3. Store in `.env` file (never commit!)

**Embed Player:**
```jsx
// Frontend
<iframe
  src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator`}
  width="100%"
  height="352"
  frameBorder="0"
  allowFullScreen=""
  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
  loading="lazy"
/>
```

**Metadata API Call (Optional):**
```javascript
// Backend: Get song details
async function getSongMetadata(spotifyTrackId, accessToken) {
  const response = await fetch(`https://api.spotify.com/v1/tracks/${spotifyTrackId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.json();
  // Returns: name, artist, album, release_date, external_urls, images, etc.
}
```

### 5.3 Handling YouTube as Fallback

If song unavailable on Spotify:
1. Store YouTube video ID in DynamoDB
2. Use YouTube embed iframe:
```jsx
<iframe
  width="100%"
  height="352"
  src={`https://www.youtube.com/embed/${youtubeId}`}
  frameBorder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
/>
```

---

## 6. SCALING & PERFORMANCE

### 6.1 Traffic Projections

| Users     | Daily API Calls | Lambda Invocations | DynamoDB WCU | Estimated Cost |
|-----------|-----------------|-------------------|-------------|----------------|
| 1K        | 1K              | 1K                | 10          | $0.50/month    |
| 10K       | 10K             | 10K               | 50          | $2.50/month    |
| 100K      | 100K            | 100K              | 500         | $25/month      |
| 1M        | 1M              | 1M                | 5K          | $250/month     |

AWS free tier covers: Lambda (1M invocations/month), DynamoDB (25GB storage, 25 RCU/WCU), S3 (5GB), CloudFront (1TB/month)

### 6.2 Optimization Strategies

**Frontend:**
- Code-split components (React.lazy)
- Image optimization (WebP, lazy loading)
- Service worker for offline caching
- Minify & compress (Vite does this)

**Backend:**
- Lambda cold start <1s (acceptable)
- Use CloudFront caching for `GET /song/today` (cache 24 hours)
- Enable DynamoDB auto-scaling
- Compress API responses (gzip)

**Database:**
- Use DynamoDB on-demand pricing (auto-scale)
- Single-digit ms latency guaranteed
- TTL on old schedule entries (auto-cleanup)

### 6.3 Monitoring & Analytics

**CloudWatch Metrics:**
- Lambda invocations, duration, errors
- DynamoDB read/write capacity
- API Gateway latency, 4xx/5xx errors

**Dashboard:**
```
GET /admin/analytics
- Total plays this month
- Top 10 songs by view count
- Admin actions (schedules made)
- Error rates
```

---

## 7. SECURITY

### 7.1 Authentication for Admin

**Option A: AWS Cognito (Recommended)**
- Email/password login
- MFA support
- Sign-up, password reset
- OAuth2 (Google, GitHub login)

**Option B: Simple API Key**
- Hardcode a secret key in Lambda environment
- Frontend sends in header: `Authorization: Bearer SECRET_KEY`
- Less secure but simpler for MVP

**Option C: GitHub OAuth**
- Only you (as repo owner) can log in
- No separate user DB needed
- Simple for solo admin

### 7.2 CORS & Rate Limiting

**CORS Policy:**
```json
{
  "allowed_origins": ["https://ilayaraja-daily.com"],
  "allowed_methods": ["GET", "POST", "OPTIONS"],
  "allowed_headers": ["Content-Type", "Authorization"],
  "max_age": 86400
}
```

**Rate Limiting (API Gateway):**
- 1000 requests/minute per IP
- Admin endpoints: 100 requests/minute
- Prevents abuse

### 7.3 Data Privacy

- No PII stored (only song metadata)
- No tracking/analytics on users
- Spotify player respects privacy (check their policy)
- HTTPS only (AWS default)
- Regular backups (DynamoDB PITR)

---

## 8. DEPLOYMENT CHECKLIST

### Pre-Launch
- [ ] AWS account created
- [ ] S3 bucket + CloudFront distribution configured
- [ ] Lambda functions packaged & tested
- [ ] DynamoDB tables created with backups enabled
- [ ] Spotify app created, credentials stored securely
- [ ] CI/CD pipeline (GitHub Actions) set up
- [ ] Domain name (Route 53 or external registrar)
- [ ] SSL certificate (AWS Certificate Manager, free)
- [ ] Admin panel UI built & tested
- [ ] Song list curated (100+ songs)

### Launch Day
- [ ] Build & deploy frontend
- [ ] Deploy Lambda functions
- [ ] Load initial song schedule to DynamoDB
- [ ] Test end-to-end (visit URL, play song)
- [ ] Monitor CloudWatch for errors
- [ ] Announce! 🎉

### Post-Launch
- [ ] Weekly song curation
- [ ] Monthly analytics review
- [ ] Monitor costs (should be <$30/month)
- [ ] Collect user feedback
- [ ] Add new features (favorites, playlist export, social share)

---

## 9. COST BREAKDOWN (Monthly Estimate)

| Service        | Free Tier             | Usage (100K/month users) | Cost    |
|----------------|----------------------|--------------------------|---------|
| Lambda         | 1M invocations       | 100K requests            | $0      |
| DynamoDB       | 25GB, 25 RCU/WCU     | 500 WCU (on-demand)      | $2.50   |
| S3             | 5GB storage          | Frontend dist (50MB)     | $0      |
| CloudFront     | 1TB/month             | 100GB/month              | $0.85   |
| **Total**      | **Free tier + $3.35** | **~$3.35/month**         | ✅      |

---

## 10. FUTURE ENHANCEMENTS

**Phase 2:**
- [ ] User favorites & playlists
- [ ] Email digest (subscribe to weekly picks)
- [ ] Community ratings & comments
- [ ] Social share (Twitter, WhatsApp, Instagram)
- [ ] Song of the week voting
- [ ] Lyric display (partner with Genius API)

**Phase 3:**
- [ ] Mobile app (React Native or Flutter)
- [ ] Podcast feed (RSS)
- [ ] Mood-based recommendations
- [ ] User profiles & activity history
- [ ] Merchandise shop

**Phase 4:**
- [ ] Multi-artist support (expand beyond Ilayaraja)
- [ ] AI-powered personalization
- [ ] Offline mode (PWA)
- [ ] AR album art viewer

---

## 11. QUICK START COMMANDS

```bash
# Clone repo
git clone https://github.com/yourusername/ilayaraja-daily.git
cd ilayaraja-daily

# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Edit .env with AWS credentials, Spotify keys

# Local development
npm run dev  # Vite dev server on http://localhost:5173

# Build for production
npm run build

# Deploy frontend to S3
npm run deploy:frontend

# Deploy backend (Lambda)
npm run deploy:backend

# Load initial song data
npm run seed:songs

# Run tests
npm run test

# View logs
npm run logs:lambda
```

---

## 12. RESOURCES & LINKS

- **AWS Dashboard:** https://console.aws.amazon.com/
- **Spotify Developers:** https://developer.spotify.com/
- **React Docs:** https://react.dev/
- **Vite:** https://vitejs.dev/
- **Tailwind CSS:** https://tailwindcss.com/
- **DynamoDB Guide:** https://docs.aws.amazon.com/dynamodb/
- **Lambda Guide:** https://docs.aws.amazon.com/lambda/
- **Serverless Handbook:** https://serverless-stack.com/

---

## 13. SUPPORT & MAINTENANCE

**Ongoing Tasks:**
- Daily: Monitor CloudWatch dashboards
- Weekly: Curate & schedule next week's song
- Monthly: Review analytics, update costs
- Quarterly: Feature updates, user feedback

**Troubleshooting:**
- Song not loading? Check DynamoDB entry for today's date
- Player not playing? Verify Spotify track ID is correct
- Admin can't log in? Check Cognito user pool settings
- High costs? Review CloudWatch metrics for unexpected usage

---

## 14. FILE STRUCTURE (Complete)

```
ilayaraja-daily/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DailySongCard.jsx
│   │   │   ├── Player.jsx
│   │   │   ├── AdminPanel.jsx
│   │   │   ├── SongPicker.jsx
│   │   │   └── Navbar.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── Admin.jsx
│   │   ├── hooks/
│   │   │   ├── useSongOfDay.js
│   │   │   └── useAdmin.js
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── functions/
│   │   │   ├── getSongOfDay.js
│   │   │   ├── scheduleSong.js
│   │   │   ├── listSchedule.js
│   │   │   └── getSongList.js
│   │   ├── utils/
│   │   │   ├── dynamodb.js
│   │   │   ├── spotify.js
│   │   │   └── auth.js
│   │   └── config.js
│   ├── template.yaml  (SAM)
│   ├── package.json
│   └── .env.example
│
├── data/
│   ├── songs.json  (Master song list)
│   ├── initial-schedule.json
│   └── backup/
│
├── scripts/
│   ├── deploy.sh
│   ├── seed-database.js
│   └── export-schedule.sh
│
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── README.md
├── .env.example
└── .gitignore
```

---

**Last Updated:** February 2025
**Version:** 1.0.0
**Status:** Ready for deployment ✅

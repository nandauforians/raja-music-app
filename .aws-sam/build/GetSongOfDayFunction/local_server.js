const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });
const lambdaFunctions = require('./lambda_functions');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Mock Lambda event wrapper
const createEvent = (req) => ({
  pathParameters: req.params,
  queryStringParameters: req.query,
  headers: {
    ...req.headers,
    authorization: req.headers.authorization
  },
  body: JSON.stringify(req.body),
});

const sendResponse = (res, lambdaResponse) => {
  res.status(lambdaResponse.statusCode).json(JSON.parse(lambdaResponse.body));
};

// Map routes to lambda handlers
app.get('/song/today', async (req, res) => {
  const result = await lambdaFunctions.getSongOfDay(createEvent(req));
  sendResponse(res, result);
});

app.get('/song/archive', async (req, res) => {
  const result = await lambdaFunctions.getArchive(createEvent(req));
  sendResponse(res, result);
});

app.get('/songs/list', async (req, res) => {
  const result = await lambdaFunctions.getSongList(createEvent(req));
  sendResponse(res, result);
});

app.post('/admin/songs', async (req, res) => {
  const result = await lambdaFunctions.addSong(createEvent(req));
  res.status(result.statusCode).set(result.headers).send(result.body);
});

app.post('/admin/generate-trivia', async (req, res) => {
  const result = await lambdaFunctions.generateAdminTrivia(createEvent(req));
  sendResponse(res, result);
});

app.patch('/admin/songs/:id', async (req, res) => {
  const result = await lambdaFunctions.updateSong(createEvent(req));
  res.status(result.statusCode).set(result.headers).send(result.body);
});



app.delete('/admin/songs/:id', async (req, res) => {
  const result = await lambdaFunctions.removeSong(createEvent(req));
  sendResponse(res, result);
});

app.get('/admin/search', async (req, res) => {
  const result = await lambdaFunctions.searchSpotify(createEvent(req));
  sendResponse(res, result);
});

app.get('/admin/karaoke-upload-url', async (req, res) => {
  const result = await lambdaFunctions.getKaraokeUploadUrl(createEvent(req));
  sendResponse(res, result);
});

app.patch('/admin/songs/:id/karaoke', async (req, res) => {
  const result = await lambdaFunctions.updateKaraokeUrl(createEvent(req));
  sendResponse(res, result);
});

app.post('/admin/schedule', async (req, res) => {
  const result = await lambdaFunctions.scheduleSong(createEvent(req));
  sendResponse(res, result);
});

app.get('/admin/schedule', async (req, res) => {
  const result = await lambdaFunctions.listSchedule(createEvent(req));
  sendResponse(res, result);
});

app.post('/admin/schedule/reset', async (req, res) => {
  const result = await lambdaFunctions.resetSchedule(createEvent(req));
  sendResponse(res, result);
});

app.post('/song/score', async (req, res) => {
  const result = await lambdaFunctions.scoreVocal(createEvent(req));
  sendResponse(res, result);
});

app.post('/song/convert-to-mp3', async (req, res) => {
  const result = await lambdaFunctions.convertToMp3(createEvent(req));
  sendResponse(res, result);
});

// Pitch proxy: fetches pitch JSON directly from S3 to avoid CloudFront CORS/routing issues
app.get('/song/pitch-proxy', async (req, res) => {
  const result = await lambdaFunctions.pitchProxy(createEvent(req));
  sendResponse(res, result);
});

// Gamification & Tracking
app.post('/activity/track', async (req, res) => {
  const result = await lambdaFunctions.trackActivity(createEvent(req));
  sendResponse(res, result);
});

app.post('/song/recording/save', async (req, res) => {
  const result = await lambdaFunctions.saveRecording(createEvent(req));
  sendResponse(res, result);
});

app.get('/user/recordings', async (req, res) => {
  const result = await lambdaFunctions.getUserRecordings(createEvent(req));
  sendResponse(res, result);
});

app.get('/user/stats', async (req, res) => {
  const result = await lambdaFunctions.getUserStats(createEvent(req));
  sendResponse(res, result);
});

app.get('/admin/gamification', async (req, res) => {
  const result = await lambdaFunctions.getAdminGamification(createEvent(req));
  sendResponse(res, result);
});

app.get('/users/rankings', async (req, res) => {
  const result = await lambdaFunctions.getLeaderboards(createEvent(req));
  sendResponse(res, result);
});

app.post('/user/profile', async (req, res) => {
  const result = await lambdaFunctions.updateUserProfile(createEvent(req));
  sendResponse(res, result);
});

app.post('/admin/payout', async (req, res) => {
  const result = await lambdaFunctions.adminPayout(createEvent(req));
  sendResponse(res, result);
});

app.post('/incentive/request', async (req, res) => {
  const result = await lambdaFunctions.requestIncentive(createEvent(req));
  sendResponse(res, result);
});

app.get('/admin/incentives', async (req, res) => {
  const result = await lambdaFunctions.getIncentiveRequests(createEvent(req));
  sendResponse(res, result);
});

app.post('/admin/incentives/approve', async (req, res) => {
  const result = await lambdaFunctions.approveIncentive(createEvent(req));
  sendResponse(res, result);
});

app.post('/admin/incentives/reject', async (req, res) => {
  const result = await lambdaFunctions.rejectIncentive(createEvent(req));
  sendResponse(res, result);
});

app.post('/rate', async (req, res) => {
  const result = await lambdaFunctions.rateSong(createEvent(req));
  sendResponse(res, result);
});

app.get('/song/rating', async (req, res) => {
  const result = await lambdaFunctions.getUserRating(createEvent(req));
  sendResponse(res, result);
});

app.get('/songs/top-rated', async (req, res) => {
  const result = await lambdaFunctions.getTopRatedSongs(createEvent(req));
  sendResponse(res, result);
});

app.post('/song/track-playback', async (req, res) => {
  const result = await lambdaFunctions.trackPlayback(createEvent(req));
  sendResponse(res, result);
});

app.get('/health', async (req, res) => {
  const result = await lambdaFunctions.health(createEvent(req));
  sendResponse(res, result);
});

app.post('/voice-command', async (req, res) => {
  const result = await lambdaFunctions.voiceCommand(createEvent(req));
  sendResponse(res, result);
});


app.get('/admin/youtube-search', async (req, res) => {
  const result = await lambdaFunctions.searchYouTube(createEvent(req));
  sendResponse(res, result);
});

// User Preferences
app.get('/user/preferences', async (req, res) => {
  const result = await lambdaFunctions.getUserPreferences(createEvent(req));
  sendResponse(res, result);
});
app.post('/user/preferences', async (req, res) => {
  const result = await lambdaFunctions.saveUserPreferences(createEvent(req));
  sendResponse(res, result);
});

// Song Suggestions
app.post('/suggestions', async (req, res) => {
  const result = await lambdaFunctions.suggestSong(createEvent(req));
  sendResponse(res, result);
});
app.get('/admin/suggestions', async (req, res) => {
  const result = await lambdaFunctions.getAdminSuggestions(createEvent(req));
  sendResponse(res, result);
});
app.post('/admin/suggestions/:id/approve', async (req, res) => {
  const result = await lambdaFunctions.approveSuggestion(createEvent(req));
  sendResponse(res, result);
});
app.post('/admin/suggestions/:id/reject', async (req, res) => {
  const result = await lambdaFunctions.rejectSuggestion(createEvent(req));
  sendResponse(res, result);
});


const PORT = 4242;
app.listen(PORT, () => {
  console.log(`🚀 Local Backend API running on http://localhost:${PORT}`);
});

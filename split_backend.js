const fs = require('fs');

const content = fs.readFileSync('backend/lambda_functions.js', 'utf8');

// The exported functions we want to extract
const handlers = {
  songs: ['getSongOfDay', 'getArchive', 'getSongList', 'addSong', 'updateSong', 'removeSong'],
  schedule: ['scheduleSong', 'listSchedule', 'resetSchedule'],
  users: ['getLeaderboards', 'getUserStats', 'updateUserProfile', 'trackPlayback', 'trackActivity', 'getUserRating', 'rateSong', 'getTopRatedSongs', 'getUserPreferences', 'saveUserPreferences'],
  karaoke: ['getKaraokeUploadUrl', 'updateKaraokeUrl', 'scoreVocal', 'convertToMp3', 'pitchProxy', 'saveRecording', 'getUserRecordings'],
  admin: ['getAdminGamification', 'adminPayout', 'requestIncentive', 'getIncentiveRequests', 'approveIncentive', 'rejectIncentive', 'generateAdminTrivia'],
  social: ['postDailySocials', 'searchSpotify', 'searchYouTube', 'voiceCommand'],
  suggestions: ['suggestSong', 'getAdminSuggestions', 'approveSuggestion', 'rejectSuggestion'],
  health: ['health']
};

const getCommonImports = () => `const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');
`;

const helpers = {
  getRandomSong: content.match(/async function getRandomSong[\s\S]*?\n\}/)[0]
};

const functions = {};
const lines = content.split('\n');

let currentFn = null;
let currentCode = [];
let braceCount = 0;

for (const line of lines) {
  const match = line.match(/^exports\.([a-zA-Z0-9_]+)\s*=\s*(async\s+)?\(event\)\s*=>\s*\{/);
  
  if (match && braceCount === 0) {
    currentFn = match[1];
    currentCode = [line];
    braceCount = 1;
    continue;
  }
  
  if (currentFn) {
    currentCode.push(line);
    // Rough brace counting (ignores strings/comments but usually works for nicely formatted code)
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;
    
    if (braceCount === 0) {
      functions[currentFn] = currentCode.join('\n');
      currentFn = null;
      currentCode = [];
    }
  }
}

for (const [moduleName, exportsList] of Object.entries(handlers)) {
  let moduleCode = getCommonImports() + '\n';
  
  if (moduleName === 'songs') {
     moduleCode += `const { GoogleGenerativeAI } = require('@google/generative-ai');\n`;
     moduleCode += helpers.getRandomSong + '\n\n';
  }
  if (moduleName === 'social') {
     moduleCode += `const { TwitterApi } = require('twitter-api-v2');\n\n`;
  }
  if (moduleName === 'karaoke') {
     moduleCode += `const { s3, getS3SignedUrl, PutObjectCommand, GetObjectCommand, RECORDINGS_BUCKET } = require('../utils/s3');\n`;
     moduleCode += `const ffmpeg = require('fluent-ffmpeg');\n`;
     moduleCode += `const ffmpegStatic = require('ffmpeg-static');\n`;
     moduleCode += `ffmpeg.setFfmpegPath(ffmpegStatic);\n\n`;
  }
  if (moduleName === 'admin') {
      moduleCode += `const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');\n`;
      moduleCode += `const sqsClient = new SQSClient({ region: 'us-east-1' });\n\n`;
  }

  for (const fnName of exportsList) {
    if (functions[fnName]) {
      moduleCode += functions[fnName] + '\n\n';
    } else {
      console.log('WARNING: Missing function', fnName);
    }
  }

  fs.writeFileSync(`backend/handlers/${moduleName}.js`, moduleCode);
}
console.log("Successfully extracted to backend/handlers/");

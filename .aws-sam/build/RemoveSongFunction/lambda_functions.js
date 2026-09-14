// ============================================================================
// AWS LAMBDA FUNCTIONS FOR ILAYARAJA DAILY MUSIC APP (MongoDB Backend)
// ============================================================================

const { MongoClient } = require('mongodb');
const { OAuth2Client } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegStatic);
const { getSignedUrl } = require('@aws-sdk/cloudfront-signer');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const sqsClient = new SQSClient({ region: 'us-east-1' });

const fs = require('fs');
const path = require('path');
let cachedPrivateKey = null;

function getCloudFrontPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;
  // Prefer env var (works in Lambda). Fall back to local .pem file (for local dev).
  if (process.env.CLOUDFRONT_PRIVATE_KEY && process.env.CLOUDFRONT_PRIVATE_KEY.includes('PRIVATE KEY')) {
    cachedPrivateKey = process.env.CLOUDFRONT_PRIVATE_KEY.replace(/\\n/g, '\n');
    return cachedPrivateKey;
  }
  try {
    cachedPrivateKey = fs.readFileSync(path.join(__dirname, 'private_key.pem'), 'utf8');
    return cachedPrivateKey;
  } catch (e) {
    console.error("Failed to read private_key.pem and CLOUDFRONT_PRIVATE_KEY env var not set.", e);
    return null;
  }
}

const CLOUDFRONT_DOMAIN = 'ddttm9vr604n9.cloudfront.net';

function signCloudFrontUrl(anyUrl) {
  if (!anyUrl) return anyUrl;
  try {
    const urlObj = new URL(anyUrl);
    let key;

    if (urlObj.hostname.includes('amazonaws.com')) {
      // Raw S3 URL: extract the path as the key
      key = urlObj.pathname.replace(/^\/+/, '');
    } else if (urlObj.hostname.includes('cloudfront.net')) {
      // Already a CloudFront URL (possibly stale/expired): re-sign with a fresh expiry
      key = urlObj.pathname.replace(/^\/+/, '');
    } else {
      // Unknown URL type, return as-is
      return anyUrl;
    }

    const privateKey = getCloudFrontPrivateKey();

    if (!privateKey || !process.env.CLOUDFRONT_KEY_PAIR_ID) {
      console.log("Missing private key or key pair ID. Returning original URL.");
      return anyUrl;
    }

    const cfUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;
    return getSignedUrl({
      url: cfUrl,
      keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
      privateKey: privateKey,
      dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // 24 hours expiry
    });
  } catch(e) {
    console.error("Failed to sign CloudFront URL:", e);
    return anyUrl;
  }
}

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function getDb() {
  if (cachedClient) {
    return cachedClient.db("raja-music-db");
  }
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client.db("raja-music-db");
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE,PUT,PATCH',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-user-id',
  'Content-Type': 'application/json',
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyAdminToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized: No token provided');
  
  try {
    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    if (payload.email !== 'nanda.uforians@gmail.com') {
      throw new Error(`Unauthorized: Email ${payload.email} is not Admin`);
    }
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error(`Unauthorized: ${error.message}`);
  }
}

// ============================================================================
// 1: GET TODAY'S SONG
// ============================================================================
exports.getSongOfDay = async (event) => {
  try {
    const db = await getDb();
    let today = new Date().toISOString().split('T')[0];
    
    // Allow previewing a specific date
    if (event.queryStringParameters && event.queryStringParameters.date) {
      today = event.queryStringParameters.date;
    }

    const scheduleCol = db.collection("schedule");
    const songsCol = db.collection("songs");

    let selectedSong;
    let source;

    if (event.queryStringParameters && event.queryStringParameters.songId) {
      selectedSong = await songsCol.findOne({ id: String(event.queryStringParameters.songId) });
      source = 'direct';
    }

    if (!selectedSong) {
      const scheduledSong = await scheduleCol.findOne({ dateISO8601: today });

      if (scheduledSong) {
        selectedSong = await songsCol.findOne({ id: scheduledSong.song_id });
        if (!selectedSong) {
          selectedSong = scheduledSong; // Fallback
        }
        // Attach schedule overrides
        if (scheduledSong.karaoke_enabled !== undefined) {
          selectedSong.karaoke_enabled = scheduledSong.karaoke_enabled;
        }
        source = 'scheduled';
      } else {
      const todaySong = await songsCol.findOne({ last_played_date: today });
      if (todaySong) {
        selectedSong = todaySong;
      } else {
        selectedSong = await getRandomSong(db);
      }
      source = 'random_rotation';
    }
    } // End if (!selectedSong)

    let geminiTrivia = selectedSong.gemini_trivia;
    let whatsappShareText = selectedSong.whatsapp_share_text;
    
    if ((!geminiTrivia || !whatsappShareText) && process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const composer = 'Ilaiyaraaja';
        const directorStr = selectedSong.director ? `directed by ${selectedSong.director}` : '';
        const singersStr = Array.isArray(selectedSong.singers) ? selectedSong.singers.join(', ') : (selectedSong.singers || 'legendary singers');

        const updatesToSave = {};

        if (!geminiTrivia) {
          const triviaPrompt = `Write a fascinating, 2-paragraph trivia or story about the making of the song '${selectedSong.title}' from the movie '${selectedSong.movie}' ${directorStr}, composed by ${composer}. Focus on musical brilliance or interesting facts. Keep it engaging.`;
          const triviaResult = await model.generateContent(triviaPrompt);
          geminiTrivia = triviaResult.response.text();
          updatesToSave.gemini_trivia = geminiTrivia;
        }

        if (!whatsappShareText) {
          const sharePrompt = `Create a short, catchy, intriguing WhatsApp share message for an Ilaiyaraaja daily song guessing puzzle.
Song Details:
- Movie: ${selectedSong.movie} (${selectedSong.year || 'Classic'})
- Singers: ${singersStr}
- Composer: ${composer}

CRITICAL RULES:
1. Do NOT mention the song title anywhere in the message.
2. Give a teaser hint incorporating the Movie ('${selectedSong.movie}'), Singers ('${singersStr}'), and an intriguing musical vibe or clue about the song.
3. Keep it under 280 characters, fun, engaging with appropriate emojis.
4. End with a call to action like "Can you guess today's Maestro classic?" without adding any link (the link will be appended separately).
5. Output ONLY the plain text of the WhatsApp message, no extra markdown or quotes.`;

          const shareResult = await model.generateContent(sharePrompt);
          whatsappShareText = shareResult.response.text().trim().replace(/^["']|["']$/g, '');
          updatesToSave.whatsapp_share_text = whatsappShareText;
        }

        if (Object.keys(updatesToSave).length > 0) {
          await songsCol.updateOne(
            { id: selectedSong.id },
            { $set: updatesToSave }
          );
        }
      } catch (geminiError) {
        console.error("Gemini Generation Error:", geminiError);
        if (!geminiTrivia) geminiTrivia = selectedSong.description || `A legendary composition by ${selectedSong.director || 'Ilaiyaraaja'}.`;
        if (!whatsappShareText) {
          const singersStr = Array.isArray(selectedSong.singers) ? selectedSong.singers.join(' & ') : '';
          whatsappShareText = `🎶 Today's Maestro Teaser: A magical ${selectedSong.movie} track${singersStr ? ` sung by ${singersStr}` : ''}! Can you guess today's classic? 🎧`;
        }
      }
    }

    if (!whatsappShareText) {
      const singersStr = Array.isArray(selectedSong.singers) ? selectedSong.singers.join(' & ') : '';
      whatsappShareText = `🎶 Today's Maestro Teaser: A magical ${selectedSong.movie} track${singersStr ? ` sung by ${singersStr}` : ''}! Can you guess today's classic? 🎧`;
    }

    // Clean up _id for serialization
    if (selectedSong._id) delete selectedSong._id;

    // Fetch user's rating if logged in
    let userRating = null;
    const userId = event.headers?.['x-user-id'] || event.requestContext?.authorizer?.claims?.sub;
    if (userId) {
      const existingRating = await db.collection('ratings').findOne({ userId, songId: selectedSong.id });
      if (existingRating) {
        userRating = existingRating.rating;
      }
    }

    if (selectedSong.original_url) selectedSong.original_url = signCloudFrontUrl(selectedSong.original_url);
    if (selectedSong.karaoke_url) selectedSong.karaoke_url = signCloudFrontUrl(selectedSong.karaoke_url);
    if (selectedSong.pitch_data_url) selectedSong.pitch_data_url = signCloudFrontUrl(selectedSong.pitch_data_url);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        song: { ...selectedSong, gemini_trivia: geminiTrivia, whatsapp_share_text: whatsappShareText },
        userRating,
        source,
      }),
    };
  } catch (error) {
    console.error('Error in getSongOfDay:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 1b: GET ARCHIVE
// ============================================================================
exports.getArchive = async (event) => {
  try {
    const db = await getDb();
    const scheduleCol = db.collection("schedule");
    const songsCol = db.collection("songs");
    
    // Parse query parameters
    const search = (event.queryStringParameters && event.queryStringParameters.q) ? event.queryStringParameters.q.toLowerCase() : '';
    const today = new Date().toISOString().split('T')[0];
    
    // Get all scheduled songs strictly before today
    const pastSchedules = await scheduleCol.find({ dateISO8601: { $lt: today } }).sort({ dateISO8601: -1 }).toArray();
    
    const results = [];
    for (const item of pastSchedules) {
      let song = await songsCol.findOne({ id: item.song_id });
      if (!song) continue;
      
      // Merge schedule overrides
      if (item.karaoke_enabled !== undefined) {
        song.karaoke_enabled = item.karaoke_enabled;
      }
      
      // Apply search filter if provided
      if (search) {
        const titleMatch = song.title && song.title.toLowerCase().includes(search);
        const movieMatch = song.movie && song.movie.toLowerCase().includes(search);
        const yearMatch = song.year && song.year.toString().includes(search);
        if (!titleMatch && !movieMatch && !yearMatch) {
          continue;
        }
      }
      
      
      song.scheduled_date = item.dateISO8601;
      
      if (song.original_url) song.original_url = signCloudFrontUrl(song.original_url);
      if (song.karaoke_url) song.karaoke_url = signCloudFrontUrl(song.karaoke_url);
      if (song.pitch_data_url) song.pitch_data_url = signCloudFrontUrl(song.pitch_data_url);
      
      results.push(song);
    }
    
    return { 
      statusCode: 200, 
      headers: corsHeaders, 
      body: JSON.stringify({ success: true, count: results.length, archive: results }) 
    };
  } catch (error) {
    console.error('Error in getArchive:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

async function getRandomSong(db) {
  const songsCol = db.collection("songs");
  const today = new Date();
  const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

  let availableSongs = await songsCol.find({
    $or: [
      { last_played_date: { $exists: false } },
      { last_played_date: { $lt: ninetyDaysAgo } }
    ]
  }).toArray();

  if (availableSongs.length === 0) {
    availableSongs = await songsCol.find().sort({ last_played_date: 1 }).limit(10).toArray();
  }
  
  if (availableSongs.length === 0) throw new Error('No songs in database');

  const randomIndex = Math.floor(Math.random() * availableSongs.length);
  const selectedSong = availableSongs[randomIndex];

  await songsCol.updateOne(
    { _id: selectedSong._id },
    { $set: { last_played_date: today.toISOString().split('T')[0] } }
  );

  return selectedSong;
}

// ============================================================================
// 2: SCHEDULE SONG
// ============================================================================
exports.scheduleSong = async (event) => {
  try {
    await verifyAdminToken(event);
    const body = JSON.parse(event.body);
    const { dateISO8601, song_id, title, movie, year, karaoke_enabled } = body;

    const db = await getDb();
    const scheduleCol = db.collection("schedule");

    // Validation: prevent scheduling the same song on a different day
    const existing = await scheduleCol.findOne({ song_id, dateISO8601: { $ne: dateISO8601 } });
    if (existing) {
      throw new Error(`This song is already scheduled for ${existing.dateISO8601}. A song can only be scheduled once.`);
    }

    await scheduleCol.updateOne(
      { dateISO8601 },
      { $set: { 
          song_id, title, movie, year, 
          karaoke_enabled: karaoke_enabled !== false, // default to true
          createdAt: new Date().toISOString() 
        } 
      },
      { upsert: true }
    );

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: `Scheduled` }) };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 3: LIST SCHEDULE
// ============================================================================
exports.listSchedule = async (event) => {
  try {
    await verifyAdminToken(event);
    const db = await getDb();
    const schedule = await db.collection("schedule").find({}).sort({ dateISO8601: 1 }).toArray();

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, count: schedule.length, schedule }) };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 4: GET SONG LIST
// ============================================================================
exports.getSongList = async (event) => {
  try {
    const pageSize = parseInt(event.queryStringParameters?.pageSize || '20');
    const pageIndex = parseInt(event.queryStringParameters?.page || '0');
    
    const db = await getDb();
    const songs = await db.collection("songs")
      .find({})
      .skip(pageIndex * pageSize)
      .limit(pageSize)
      .toArray();

    songs.forEach(song => {
      if (song.original_url) song.original_url = signCloudFrontUrl(song.original_url);
      if (song.karaoke_url) song.karaoke_url = signCloudFrontUrl(song.karaoke_url);
      if (song.pitch_data_url) song.pitch_data_url = signCloudFrontUrl(song.pitch_data_url);
    });
      
    const total = await db.collection("songs").countDocuments();

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, page: pageIndex, pageSize, total, songs }) };
  } catch (error) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 6: HEALTH
// ============================================================================
exports.health = async (event) => {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, status: 'healthy' }) };
};

// ============================================================================
// 7: RESET SCHEDULE
// ============================================================================
exports.resetSchedule = async (event) => {
  try {
    await verifyAdminToken(event);
    const db = await getDb();
    await db.collection("schedule").deleteMany({});
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: `Deleted all scheduled entries.` }) };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// ADMIN: GENERATE TRIVIA
// ============================================================================

exports.generateAdminTrivia = async (event) => {
  try {
    await verifyAdminToken(event);

    const body = JSON.parse(event.body);
    const prompt = body.prompt;

    if (!prompt) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Prompt is required' }) };
    }

    if (!process.env.GEMINI_API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Gemini API key missing' }) };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);
    const trivia = result.response.text();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, trivia })
    };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 8: ADD SONG
// ============================================================================

/**
 * Enriches a song object with actors and searchable_text via Gemini.
 * Called automatically when a new song is added, and by the backfill script.
 */
async function enrichSongMetadata(song) {
  if (!process.env.GEMINI_API_KEY) return song;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are a Tamil cinema expert. For the Tamil/Telugu film "${song.movie}" (${song.year || 'unknown year'}), return ONLY a raw JSON object (no markdown):
{"actors":["Lead Actor 1","Lead Actor 2"],"director":"Director Name"}
Rules: actors = 2-3 lead cast members (not musicians). director = film director (not Ilayaraja). Use common English transliterations. If unsure, return empty values.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g,'').replace(/```/g,'').trim();
    const data = JSON.parse(text);
    const actors = Array.isArray(data.actors) ? data.actors : [];
    const director = data.director || song.director || '';
    const parts = [song.title, song.movie, song.year ? String(song.year) : '', song.decade || '', director, (song.singers || []).join(' '), actors.join(' ')];
    const searchable_text = parts.filter(Boolean).join(' ').toLowerCase();
    return { ...song, actors, director: director || song.director, searchable_text };
  } catch (e) {
    console.error('enrichSongMetadata failed:', e.message);
    // Fallback: build searchable_text from what we have
    const parts = [song.title, song.movie, song.year ? String(song.year) : '', song.decade || '', song.director || '', (song.singers || []).join(' ')];
    return { ...song, searchable_text: parts.filter(Boolean).join(' ').toLowerCase() };
  }
}

exports.addSong = async (event) => {
  try {
    await verifyAdminToken(event);
    const body = JSON.parse(event.body);
    const db = await getDb();
    
    if (!body.id) {
      // Find the highest numeric ID
      const allSongs = await db.collection("songs").find({}, { projection: { id: 1 } }).toArray();
      let maxId = 0;
      for (const song of allSongs) {
        const numId = parseInt(song.id, 10);
        if (!isNaN(numId) && numId > maxId) {
          maxId = numId;
        }
      }
      body.id = String(maxId + 1);
    }
    
    body.addedAt = new Date().toISOString();

    // Duplicate Check
    if (!body.force) {
      function normalizeString(str) {
        if (!str) return '';
        return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
      }

      const normTitle = normalizeString(body.title);
      const normMovie = normalizeString(body.movie);
      const spotifyId = body.spotify_id;

      if (normMovie) {
        // Fetch all songs with matching normalized movie
        const allSongs = await db.collection("songs").find({}).toArray();
        const sameMovieSongs = allSongs.filter(s => normalizeString(s.movie) === normMovie);
        
        let duplicateReason = null;
        let duplicateSong = null;

        for (const s of sameMovieSongs) {
          const sNormTitle = normalizeString(s.title);
          if (sNormTitle === normTitle && normTitle !== '') {
            duplicateReason = 'Title Match (Same Movie)';
            duplicateSong = s;
            break;
          } else if (s.spotify_id && spotifyId && s.spotify_id === spotifyId) {
            duplicateReason = 'Spotify ID Match (Same Movie)';
            duplicateSong = s;
            break;
          }
        }

        if (duplicateSong) {
          return { 
            statusCode: 409, 
            headers: corsHeaders, 
            body: JSON.stringify({ 
              success: false, 
              error: `Duplicate detected (${duplicateReason}): "${duplicateSong.title}" - "${duplicateSong.movie}" (ID: ${duplicateSong.id})` 
            }) 
          };
        }
      }
    }
    delete body.force; // Don't save the force flag to the DB

    // Auto-enrich with actors + searchable_text via Gemini (async, best-effort)
    const enrichedBody = await enrichSongMetadata(body);
    await db.collection("songs").insertOne(enrichedBody);

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: 'Song added', id: enrichedBody.id }) };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 9: EDIT SONG (PATCH)
// ============================================================================
exports.updateSong = async (event) => {
  try {
    await verifyAdminToken(event);
    const songId = event.pathParameters?.id;
    if (!songId) throw new Error("Missing song ID");
    
    const body = JSON.parse(event.body);
    const db = await getDb();
    
    const { _id, id, ...updateFields } = body; // don't update immutable IDs
    
    await db.collection("songs").updateOne(
      { id: songId },
      { $set: updateFields }
    );

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: 'Song updated' }) };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 11: REMOVE SONG
// ============================================================================
exports.removeSong = async (event) => {
  try {
    await verifyAdminToken(event);
    const songId = event.pathParameters?.id;
    if (!songId) throw new Error("Missing song ID");

    const db = await getDb();
    await db.collection("songs").deleteOne({ id: songId });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: 'Song removed' }) };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 10: SEARCH SPOTIFY
// ============================================================================
exports.searchSpotify = async (event) => {
  try {
    // await verifyAdminToken(event); // Removed so normal users can suggest songs
    const query = event.queryStringParameters?.q;
    if (!query) throw new Error("Search query required");

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });
    
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // Append artist filter to restrict results to Ilayaraja
    const spotifyQuery = `${query} artist:Ilayaraja`;
    const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(spotifyQuery)}&type=track&limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const searchData = await searchRes.json();
    
    const results = searchData.tracks?.items.map(track => ({
      spotify_id: track.id,
      title: track.name,
      movie: track.album.name,
      year: track.album.release_date ? track.album.release_date.split('-')[0] : null,
      artist: track.artists.map(a => a.name).join(', '),
      preview_url: track.preview_url,
      image: track.album.images?.[0]?.url
    })) || [];

    // Duplicate check
    const db = await getDb();
    const existingSongs = await db.collection('songs').find({}, { projection: { id: 1, title: 1, movie: 1, spotify_id: 1 } }).toArray();

    results.forEach(res => {
      res.isDuplicate = false;
      const dup = existingSongs.find(s => 
        (s.spotify_id && s.spotify_id === res.spotify_id) || 
        (s.title.toLowerCase() === res.title.toLowerCase() && s.movie.toLowerCase() === res.movie.toLowerCase())
      );
      if (dup) res.isDuplicate = true;
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, results }) };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 11: GENERATE PRESIGNED S3 URL FOR KARAOKE UPLOAD
// ============================================================================
exports.getKaraokeUploadUrl = async (event) => {
  try {
    await verifyAdminToken(event);
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl: getS3SignedUrl } = require('@aws-sdk/s3-request-presigner');

    const songId = event.queryStringParameters?.songId;
    const ext = (event.queryStringParameters?.ext || 'mp3').toLowerCase();
    if (!songId) throw new Error('songId is required');

    const contentTypeMap = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'mp4a': 'audio/mp4',
      'aac': 'audio/aac',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
    };
    const contentType = contentTypeMap[ext] || 'audio/mpeg';

    // For source files (non-mp3), store with original extension under "source/" prefix
    // The processed karaoke mp3 will be stored at {songId}.mp3 after Demucs runs
    const key = ext === 'mp3' ? `${songId}.mp3` : `source/${songId}.${ext}`;

    const s3 = new S3Client({ region: 'us-east-1' });
    const command = new PutObjectCommand({
      Bucket: 'uforian-karaoke-tracks',
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getS3SignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `https://uforian-karaoke-tracks.s3.us-east-1.amazonaws.com/${key}`;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, uploadUrl, publicUrl, key, ext })
    };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 12: UPDATE SONG KARAOKE URL
// ============================================================================
exports.updateKaraokeUrl = async (event) => {
  try {
    await verifyAdminToken(event);
    const songId = event.pathParameters?.id;
    const body = JSON.parse(event.body || '{}');
    const { karaoke_url, original_url, karaoke_snippet_start, karaoke_snippet_end } = body;

    if (!songId) throw new Error('songId is required');

    const updateFields = {};
    if (karaoke_url !== undefined) updateFields.karaoke_url = karaoke_url;
    if (original_url !== undefined) updateFields.original_url = original_url;
    if (karaoke_snippet_start !== undefined) updateFields.karaoke_snippet_start = parseInt(karaoke_snippet_start, 10);
    if (karaoke_snippet_end !== undefined) updateFields.karaoke_snippet_end = parseInt(karaoke_snippet_end, 10);

    const db = await getDb();
    const songs = db.collection('songs');
    await songs.updateOne({ id: songId }, { $set: updateFields });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// KARAOKE SCORING (GEMINI MULTIMODAL)
// ============================================================================
exports.scoreVocal = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { audioBase64, mimeType, songId, userId, userName, userPicture, pitchAccuracy } = body;

    if (!audioBase64 || !songId) {
      throw new Error('Missing audio or songId');
    }

    const db = await getDb();
    const songs = db.collection('songs');
    const song = await songs.findOne({ id: songId });
    if (!song) throw new Error('Song not found');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a trained classical playback singer and a strict but constructive talent show judge (like K. S. Chithra or Mano).
I am providing you with an audio recording of a user singing karaoke to the Ilayaraja song "${song.title}" from the movie ${song.movie}.
Here are the lyrics they are singing:
---
${song.lyrics || "No lyrics provided, please judge based on pitch and melody."}
---
The user's mathematical pitch accuracy score compared to the original singer is ${pitchAccuracy || 'unknown'}%.

Please analyze their vocal performance technically and objectively. 
Do not be overly dramatic or enthusiastic. Provide grounded, technical feedback on their pitch, rhythm, breath control, and expression. Use the provided pitch accuracy score to inform your judgment.
Return your judgment strictly as a JSON object with three fields:
1. "score": an integer from 0 to 100.
2. "brief_summary": a short, technical, 1-2 sentence feedback (e.g. "Good pitch control, but watch your breath support on the higher notes.").
3. "detailed_summary": A comprehensive Markdown breakdown covering Pitch Accuracy, Timing & Rhythm, Breath & Dynamics, and Technical Suggestions for Improvement.

Do NOT return markdown formatting like \`\`\`json, just the raw JSON text.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType || 'audio/webm'
        }
      },
      prompt
    ]);

    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    let scoreData;
    try {
      scoreData = JSON.parse(text);
      // Map 'feedback' back to 'brief_summary' in case the AI uses the old key
      if (scoreData.feedback && !scoreData.brief_summary) {
          scoreData.brief_summary = scoreData.feedback;
      }
    } catch (e) {
      console.error("Failed to parse Gemini response:", text);
      scoreData = { 
          score: 75, 
          brief_summary: "Great effort, but the AI couldn't quite score it. Keep practicing!",
          detailed_summary: "### AI Processing Error\nWe couldn't generate a detailed report for this performance. Please try again!"
      };
    }

    if (userId) {
      // Only upsert the user profile details, don't update scores here.
      // Score updating is moved to saveRecording to enforce 1 submission per song.
      const users = db.collection('users');
      await users.updateOne(
        { userId },
        { 
          $set: { 
            ...(userName && { name: userName }),
            ...(userPicture && { picture: userPicture })
          }
        },
        { upsert: true }
      );
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        score: scoreData.score, 
        feedback: scoreData.brief_summary, 
        detailed_summary: scoreData.detailed_summary 
      })
    };
  } catch (error) {
    console.error("Scoring error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// Convert WebM recording to MP3
exports.convertToMp3 = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { audioBase64 } = body;

    if (!audioBase64) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'No audio provided' }) };
    }

    const os = require('os');
    const crypto = require('crypto');
    const tempId = crypto.randomBytes(16).toString('hex');
    const inputPath = path.join(os.tmpdir(), `${tempId}.webm`);
    const outputPath = path.join(os.tmpdir(), `${tempId}.mp3`);

    // Write input base64 to temp file
    const buffer = Buffer.from(audioBase64.split(',')[1] || audioBase64, 'base64');
    fs.writeFileSync(inputPath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .on('error', (err) => {
          console.error('An error occurred during mp3 conversion: ' + err.message);
          reject(err);
        })
        .on('end', () => {
          resolve();
        })
        .save(outputPath);
    });

    // Read back MP3 and convert to base64
    const mp3Buffer = fs.readFileSync(outputPath);
    const mp3Base64 = `data:audio/mp3;base64,${mp3Buffer.toString('base64')}`;

    // Clean up temp files
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (e) {
      console.error('Failed to cleanup temp files', e);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, audioBase64: mp3Base64 })
    };
  } catch (error) {
    console.error("Conversion error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// PITCH PROXY - Fetches pitch JSON from S3 to avoid browser CORS/CloudFront issues
// ============================================================================
exports.pitchProxy = async (event) => {
  try {
    const songId = event.queryStringParameters?.songId;
    if (!songId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'songId required' }) };
    }

    const bucket = 'uforian-karaoke-tracks';
    const key = `pitch_data_${songId}.json`;

    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: 'us-east-1' });

    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await s3.send(command);
      const str = await response.Body.transformToString();
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=3600',
        },
        body: str,
      };
    } catch (s3Error) {
      console.error('S3 Fetch Error in pitchProxy:', s3Error);
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Pitch data not found in S3 bucket' }) };
    }
  } catch (e) {
    console.error('pitchProxy error:', e);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: e.message }) };
  }
};

// Get Public Leaderboards
exports.getLeaderboards = async (event) => {
  try {
    const db = await getDb();
    const users = db.collection('users');

    const topOverall = await users
      .find({ totalPoints: { $gt: 0 } }, { projection: { _id: 0, userId: 1, name: 1, picture: 1, totalPoints: 1 } })
      .sort({ totalPoints: -1 })
      .limit(10)
      .toArray();

    const topKaraoke = await users
      .find({ karaokeCount: { $gt: 0 } }, { projection: { _id: 0, userId: 1, name: 1, picture: 1, totalKaraokeRating: 1, karaokeCount: 1 } })
      .sort({ totalKaraokeRating: -1 })
      .limit(10)
      .toArray();

    const topSongs = await db.collection('songs')
      .find({ fullListens: { $gt: 0 } }, { projection: { _id: 0, id: 1, title: 1, movie: 1, totalPlaySeconds: 1, fullListens: 1 } })
      .sort({ fullListens: -1, totalPlaySeconds: -1 })
      .limit(10)
      .toArray();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, overall: topOverall, karaoke: topKaraoke, topSongs })
    };
  } catch (error) {
    console.error("Get leaderboards error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
// ============================================================================
// GAMIFICATION & TRACKING
// ============================================================================
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: getS3SignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const RECORDINGS_BUCKET = process.env.RECORDINGS_BUCKET;

// Track Global Song Playback Time
exports.trackPlayback = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { songId, secondsPlayed, isFullListen } = body;
    
    if (!songId || secondsPlayed === undefined || secondsPlayed === null) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Missing songId or secondsPlayed' }) };
    }

    const db = await getDb();
    const songs = db.collection('songs');

    const updateDoc = {
      $inc: { totalPlaySeconds: secondsPlayed }
    };
    if (isFullListen) {
      updateDoc.$inc.fullListens = 1;
    }

    await songs.updateOne({ id: songId }, updateDoc);
    
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error("trackPlayback error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// Track Activity
exports.trackActivity = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, action, songId } = body;
    if (!userId || !action) throw new Error('Missing userId or action');

    const db = await getDb();
    const activities = db.collection('activities');
    const users = db.collection('users');
    const today = new Date().toISOString().split('T')[0];

    // Points map
    const pointsMap = {
      'login': 50,
      'listen_full': 125,
      'rate_song': 125,
      'spotify_add': 250,
      'karaoke_record': 500
    };
    const points = pointsMap[action] || 0;

    // Check caps (1 per day per action/song)
    let query = { userId, action, date: today };
    if (songId) query.songId = songId;
    
    const existing = await activities.findOne(query);
    if (existing) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, pointsAdded: 0, capped: true }) };
    }

    await activities.insertOne({ ...query, points, timestamp: new Date() });
    
    // Update user total and profile info
    await users.updateOne(
      { userId }, 
      { 
        $inc: { totalPoints: points },
        $set: { 
          ...(body.userName && { name: body.userName }),
          ...(body.userPicture && { picture: body.userPicture })
        }
      }, 
      { upsert: true }
    );

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, pointsAdded: points }) };
  } catch (error) {
    console.error('Track error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// Save Recording to S3
exports.saveRecording = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, songId, audioBase64 } = body;
    if (!userId || !songId || !audioBase64) throw new Error('Missing params');

    const today = new Date().toISOString().split('T')[0];
    const key = `recordings/${userId}/${today}_${songId}.webm`;

    const buffer = Buffer.from(audioBase64, 'base64');

    await s3.send(new PutObjectCommand({
      Bucket: RECORDINGS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'audio/webm'
    }));

    const db = await getDb();
    const newScore = body.score || 0;
    
    // Enforce 1 submission per song rule: check if they already have a recording for this song
    const existingRecording = await db.collection('recordings').findOne({ userId, songId });
    
    if (existingRecording) {
      const oldScore = existingRecording.score || 0;
      const scoreDiff = newScore - oldScore;
      
      await db.collection('recordings').updateOne(
        { _id: existingRecording._id },
        { $set: { s3Key: key, score: newScore, timestamp: new Date().toISOString() } }
      );
      
      if (scoreDiff !== 0) {
        await db.collection('users').updateOne(
          { userId },
          { $inc: { totalKaraokeRating: scoreDiff } }
        );
      }
    } else {
      const recordingDoc = {
        userId,
        songId,
        s3Key: key,
        score: newScore,
        timestamp: new Date().toISOString()
      };
      await db.collection('recordings').insertOne(recordingDoc);
      
      await db.collection('users').updateOne(
        { userId },
        { $inc: { totalKaraokeRating: newScore, karaokeCount: 1 } },
        { upsert: true }
      );
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, s3Key: key }) };
  } catch (error) {
    console.error('Save recording error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// Get User Recordings
exports.getUserRecordings = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing userId' }) };

    const db = await getDb();
    const recordings = await db.collection('recordings')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    // Fetch song titles from the songs collection to enrich the response
    const songIds = [...new Set(recordings.map(r => r.songId))];
    const songs = await db.collection('songs').find({ id: { $in: songIds } }).toArray();
    const songMap = {};
    songs.forEach(s => songMap[s.id] = s.title);

    // Generate Presigned URLs
    const enrichedRecordings = await Promise.all(recordings.map(async (r) => {
      const command = new GetObjectCommand({
        Bucket: RECORDINGS_BUCKET,
        Key: r.s3Key,
      });
      // URL expires in 1 hour
      const presignedUrl = await getS3SignedUrl(s3, command, { expiresIn: 3600 });
      return {
        id: r._id,
        songId: r.songId,
        songTitle: songMap[r.songId] || 'Unknown Song',
        score: r.score,
        timestamp: r.timestamp,
        url: presignedUrl
      };
    }));

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, recordings: enrichedRecordings }) };
  } catch (error) {
    console.error('Get user recordings error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// Get User Stats
exports.getUserStats = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) throw new Error('Missing userId');
    
    const db = await getDb();
    const activities = db.collection('activities');
    const users = db.collection('users');
    const songsCol = db.collection('songs');

    // --- JOINING BONUS LOGIC ---
    const todayStr = new Date().toISOString().split('T')[0];
    if (todayStr === '2026-08-29') {
      const hasBonus = await users.findOne({ userId, hasJoiningBonus: true });
      if (!hasBonus) {
        // Grant listen_full points for 27th and 28th
        const bonusPoints = 500; // 250 * 2
        await activities.insertMany([
          { userId, action: 'listen_full', date: '2026-08-27', points: 250, songId: 'bonus_1', timestamp: new Date('2026-08-27T12:00:00Z') },
          { userId, action: 'listen_full', date: '2026-08-28', points: 250, songId: 'bonus_2', timestamp: new Date('2026-08-28T12:00:00Z') }
        ]);
        await users.updateOne({ userId }, { $inc: { totalPoints: bonusPoints }, $set: { hasJoiningBonus: true } }, { upsert: true });
      }
    }
    // ---------------------------

    const allActivities = await activities.find({ userId }).toArray();
    const userDoc = await users.findOne({ userId }) || { totalPoints: 0 };
    
    // Aggregations
    const today = new Date();
    let daily = 0, weekly = 0, monthly = 0;
    const currentMonth = today.toISOString().slice(0, 7);
    
    // Calculate start of current week (Monday)
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
    const monday = new Date(today.setDate(diff));
    monday.setHours(0,0,0,0);
    
    // History (Mon-Sun)
    const historyMap = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    allActivities.forEach(act => {
      const actDate = new Date(act.timestamp || Date.now());
      const actDateStr = act.date || actDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Points sum
      if (actDateStr === todayStr) daily += act.points;
      if (actDateStr && actDateStr.startsWith(currentMonth)) monthly += act.points;
      if (actDate >= monday) {
        weekly += act.points;
        const dName = dayNames[actDate.getDay()];
        historyMap[dName] += act.points;
      }

    });

    const history = [
      { day: 'Mon', points: historyMap['Mon'] },
      { day: 'Tue', points: historyMap['Tue'] },
      { day: 'Wed', points: historyMap['Wed'] },
      { day: 'Thu', points: historyMap['Thu'] },
      { day: 'Fri', points: historyMap['Fri'] },
      { day: 'Sat', points: historyMap['Sat'] },
      { day: 'Sun', points: historyMap['Sun'] }
    ];

    const stats = {
      daily,
      weekly,
      monthly,
      total: userDoc.totalPoints || 0,
      mobileNumber: userDoc.mobileNumber || '',
      history
    };
    
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, stats }) };
  } catch (error) {
    console.error("getUserStats error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 19: SEARCH YOUTUBE
// ============================================================================
exports.searchYouTube = async (event) => {
  try {
    await verifyAdminToken(event);
    const query = event.queryStringParameters?.q;
    if (!query) throw new Error("Missing search query (q)");

    const ytSearch = require('yt-search');
    const r = await ytSearch(query);
    const videos = r.videos.slice(0, 10).map(v => ({
      title: v.title,
      url: v.url,
      videoId: v.videoId,
      thumbnail: v.thumbnail,
      duration: v.timestamp,
      channel: v.author.name
    }));

    return { 
      statusCode: 200, 
      headers: corsHeaders, 
      body: JSON.stringify({ success: true, videos }) 
    };
  } catch (error) {
    return { 
      statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, 
      headers: corsHeaders, 
      body: JSON.stringify({ success: false, error: error.message }) 
    };
  }
};

// Admin Gamification Leaderboard
exports.getAdminGamification = async (event) => {
  try {
    await verifyAdminToken(event);
    
    const db = await getDb();
    const usersCol = db.collection('users');
    const activitiesCol = db.collection('activities');
    
    // Fetch all users with points
    const users = await usersCol.find({ totalPoints: { $gt: 0 } }).sort({ totalPoints: -1 }).toArray();
    
    const leaderboard = [];
    
    for (const u of users) {
      // Aggregate activity counts for this user
      const userActivities = await activitiesCol.find({ userId: u.userId }).toArray();
      
      let listens = 0, spotifyAdds = 0, karaokes = 0;
      userActivities.forEach(act => {
        if (act.action === 'listen_full') listens++;
        if (act.action === 'spotify_add') spotifyAdds++;
        if (act.action === 'karaoke_record') karaokes++;
      });
      
      leaderboard.push({
        userId: u.userId,
        name: u.name || 'Anonymous User', // Need user's name? If not stored, we use a fallback
        totalPoints: u.totalPoints,
        mobileNumber: u.mobileNumber || '',
        listens,
        spotifyAdds,
        karaokes
      });
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, leaderboard }) };
  } catch (error) {
    console.error("getAdminGamification error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// Update User Profile (Mobile Number)
exports.updateUserProfile = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const userId = event.headers?.['x-user-id'] || body.userId;
    const { mobileNumber } = body;
    if (!userId || !mobileNumber) throw new Error('Missing userId or mobileNumber');

    const db = await getDb();
    const users = db.collection('users');

    await users.updateOne(
      { userId },
      { $set: { mobileNumber } },
      { upsert: true }
    );

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error("updateUserProfile error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// Admin Payout
exports.adminPayout = async (event) => {
  try {
    await verifyAdminToken(event);
    const body = JSON.parse(event.body || '{}');
    const { targetUserId, amount } = body;
    
    if (!targetUserId || !amount || amount <= 0) {
      throw new Error('Invalid payout parameters');
    }

    const db = await getDb();
    const users = db.collection('users');
    const payouts = db.collection('payouts');

    // Fetch user to verify points
    const user = await users.findOne({ userId: targetUserId });
    if (!user || (user.totalPoints || 0) < amount) {
      throw new Error('Insufficient points for payout');
    }

    // Deduct points
    await users.updateOne(
      { userId: targetUserId },
      { $inc: { totalPoints: -amount } }
    );

    // Log payout
    await payouts.insertOne({
      userId: targetUserId,
      amount,
      currency: 'INR',
      timestamp: new Date().toISOString()
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, newTotal: user.totalPoints - amount }) };
  } catch (error) {
    console.error("adminPayout error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

const { ObjectId } = require('mongodb');

exports.requestIncentive = async (event) => {
  try {
    const db = await getDb();
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'];
    if (!userId) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };

    const body = JSON.parse(event.body);
    const amount = Number(body.amount);
    const mobileNumber = body.mobileNumber;

    if (!amount || amount <= 0 || !mobileNumber) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Invalid amount or mobile number' }) };
    }

    const user = await db.collection('users').findOne({ userId });
    if (!user) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'User not found' }) };
    }

    const totalPoints = user.totalPoints || 0;
    const maxAllowed = Math.floor(totalPoints / 2);

    if (amount > maxAllowed) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: `You can only request up to 50% of your total points (${maxAllowed} pts)` }) };
    }

    // Deduct points
    await db.collection('users').updateOne(
      { userId },
      { $inc: { totalPoints: -amount } }
    );

    // Save request
    await db.collection('incentive_requests').insertOne({
      userId,
      userName: user.name || 'Unknown User',
      amount,
      mobileNumber,
      status: 'pending',
      requestedAt: new Date().toISOString()
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: 'Incentive requested successfully' }) };
  } catch (error) {
    console.error('Error in requestIncentive:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.getIncentiveRequests = async (event) => {
  try {
    const db = await getDb();
    const requests = await db.collection('incentive_requests').find({ status: 'pending' }).sort({ requestedAt: 1 }).toArray();
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, requests }) };
  } catch (error) {
    console.error('Error in getIncentiveRequests:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.approveIncentive = async (event) => {
  try {
    const db = await getDb();
    const body = JSON.parse(event.body);
    const requestId = body.requestId;
    if (!requestId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Missing requestId' }) };

    await db.collection('incentive_requests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'approved', approvedAt: new Date().toISOString() } }
    );

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('Error in approveIncentive:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.rejectIncentive = async (event) => {
  try {
    const db = await getDb();
    const body = JSON.parse(event.body);
    const requestId = body.requestId;
    if (!requestId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Missing requestId' }) };

    const reqData = await db.collection('incentive_requests').findOne({ _id: new ObjectId(requestId) });
    if (!reqData || reqData.status !== 'pending') {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Invalid or already processed request' }) };
    }

    // Refund points
    await db.collection('users').updateOne(
      { userId: reqData.userId },
      { $inc: { totalPoints: reqData.amount } }
    );

    await db.collection('incentive_requests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'rejected', rejectedAt: new Date().toISOString() } }
    );

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('Error in rejectIncentive:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.getUserRating = async (event) => {
  try {
    const db = await getDb();
    const userId = event.headers?.['x-user-id'] || event.queryStringParameters?.userId;
    const songId = event.queryStringParameters?.songId;

    if (!userId || !songId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Missing userId or songId' }) };
    }

    const existingRating = await db.collection('ratings').findOne({ userId, songId });
    return { 
      statusCode: 200, 
      headers: corsHeaders, 
      body: JSON.stringify({ success: true, rating: existingRating ? existingRating.rating : 0 }) 
    };
  } catch (error) {
    console.error('Error in getUserRating:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.rateSong = async (event) => {
  try {
    const db = await getDb();
    const body = JSON.parse(event.body || '{}');
    const userId = event.headers?.['x-user-id'] || body.userId;
    const { songId, rating } = body;
    
    if (!userId || !songId || typeof rating !== 'number' || rating < 1 || rating > 10) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Invalid rating data' }) };
    }

    const ratingsCol = db.collection('ratings');
    const songsCol = db.collection('songs');

    // Check if already rated (to determine gamification points)
    const existingRating = await ratingsCol.findOne({ userId, songId });

    // Upsert new rating
    await ratingsCol.updateOne(
      { userId, songId },
      { $set: { rating, timestamp: new Date() } },
      { upsert: true }
    );

    // Calculate new average
    const allRatings = await ratingsCol.find({ songId }).toArray();
    const sum = allRatings.reduce((acc, r) => acc + r.rating, 0);
    const avgRating = parseFloat((sum / allRatings.length).toFixed(1));
    
    await songsCol.updateOne(
      { id: songId },
      { $set: { avgRating, ratingCount: allRatings.length } }
    );

    // Gamification points (only if they haven't rated this song before)
    let pointsAwarded = 0;
    if (!existingRating) {
      pointsAwarded = 125;
      const activities = db.collection('activities');
      const query = { userId, action: 'rate_song', songId };
      const today = new Date().toISOString().split('T')[0];
      await activities.insertOne({ ...query, points: pointsAwarded, timestamp: new Date(), date: today });
      await db.collection('users').updateOne(
        { userId }, 
        { $inc: { totalPoints: pointsAwarded } },
        { upsert: true }
      );
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, avgRating, ratingCount: allRatings.length, pointsAwarded }) };
  } catch (error) {
    console.error('Error in rateSong:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.getTopRatedSongs = async (event) => {
  try {
    const db = await getDb();
    const songs = await db.collection('songs')
      .find({ ratingCount: { $gt: 0 } })
      .sort({ avgRating: -1, ratingCount: -1 })
      .limit(10)
      .project({ _id: 0, id: 1, title: 1, movie: 1, year: 1, avgRating: 1, ratingCount: 1 })
      .toArray();

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, songs }) };
  } catch (error) {
    console.error('Error in getTopRatedSongs:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ── NEW: User Preferences ───────────────────────────────────────────────────

exports.getUserPreferences = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing userId' }) };

    const db = await getDb();
    const prefs = await db.collection('user_preferences').find({ userId }).toArray();
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, preferences: prefs }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: err.message }) };
  }
};

exports.saveUserPreferences = async (event) => {
  try {
    const { userId, songId, karaoke_snippet_start, karaoke_snippet_end } = JSON.parse(event.body);
    if (!userId || !songId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing userId or songId' }) };

    // Validate max duration of 120s
    if (karaoke_snippet_start !== undefined && karaoke_snippet_end !== undefined) {
      if (karaoke_snippet_end - karaoke_snippet_start > 120000) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Snippet duration cannot exceed 120 seconds (120000 ms).' }) };
      }
    }

    const db = await getDb();
    await db.collection('user_preferences').updateOne(
      { userId, songId },
      { $set: { karaoke_snippet_start, karaoke_snippet_end, updatedAt: new Date() } },
      { upsert: true }
    );
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: err.message }) };
  }
};

// ── NEW: Song Suggestions ───────────────────────────────────────────────────

exports.suggestSong = async (event) => {
  try {
    const { userId, userName, spotifyId, title, movie, year, previewUrl, albumCoverUrl } = JSON.parse(event.body);
    if (!userId || !spotifyId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing userId or spotifyId' }) };

    const db = await getDb();
    
    // Check if song is already in DB
    const existing = await db.collection('songs').findOne({ $or: [{ spotifyId }, { title }] });
    if (existing) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Song already exists in the catalog.' }) };
    }

    // Check if suggestion already exists
    const existingSugg = await db.collection('song_suggestions').findOne({ spotifyId, status: 'pending' });
    if (existingSugg) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'This song has already been suggested and is pending review.' }) };
    }

    const suggestion = {
      _id: new (require('mongodb').ObjectId)(),
      userId,
      userName,
      spotifyId,
      title,
      movie,
      year,
      previewUrl,
      albumCoverUrl,
      status: 'pending',
      suggestedAt: new Date()
    };

    await db.collection('song_suggestions').insertOne(suggestion);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, suggestion }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: err.message }) };
  }
};

exports.getAdminSuggestions = async (event) => {
  try {
    const status = event.queryStringParameters?.status || 'pending';
    const db = await getDb();
    const suggestions = await db.collection('song_suggestions').find({ status }).sort({ suggestedAt: -1 }).toArray();
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, suggestions }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: err.message }) };
  }
};

exports.approveSuggestion = async (event) => {
  try {
    const suggestionId = event.pathParameters?.id;
    if (!suggestionId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing suggestionId' }) };

    const db = await getDb();
    const ObjectId = require('mongodb').ObjectId;
    const suggestion = await db.collection('song_suggestions').findOne({ _id: new ObjectId(suggestionId) });
    if (!suggestion) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Suggestion not found' }) };
    if (suggestion.status !== 'pending') return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Suggestion already processed' }) };

    // Approve logic: Update status, and we can trigger addSong logic or just set status to approved and let client call addSong
    // To keep it simple, we just mark it approved here. The client can call addSong separately, or we can do it here.
    // Let's do it here: call the actual addSong function logic.
    // We can simulate an event to exports.addSong.
    const addEvent = {
      body: JSON.stringify({
        title: suggestion.title,
        movie: suggestion.movie,
        year: suggestion.year,
        spotify_id: suggestion.spotifyId,
        preview_url: suggestion.previewUrl,
        album_cover_url: suggestion.albumCoverUrl
      }),
      headers: event.headers,
      requestContext: { authorizer: { principalId: 'admin' } } // fake authorizer for admin
    };
    const addRes = await exports.addSong(addEvent);
    const parsedRes = JSON.parse(addRes.body);

    if (parsedRes.success) {
      await db.collection('song_suggestions').updateOne({ _id: new ObjectId(suggestionId) }, { $set: { status: 'approved', processedAt: new Date() } });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, newSongId: parsedRes.songId }) };
    } else {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: parsedRes.error }) };
    }
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: err.message }) };
  }
};

exports.rejectSuggestion = async (event) => {
  try {
    const suggestionId = event.pathParameters?.id;
    if (!suggestionId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing suggestionId' }) };

    const db = await getDb();
    const ObjectId = require('mongodb').ObjectId;
    await db.collection('song_suggestions').updateOne(
      { _id: new ObjectId(suggestionId) },
      { $set: { status: 'rejected', processedAt: new Date() } }
    );
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: err.message }) };
  }
};

// ============================================================================
// VOICE COMMAND — AI-powered natural language song search
// POST /voice-command { transcript: "Play Thenpaandi Seemaiyile" }
// ============================================================================
exports.voiceCommand = async (event) => {
  try {
    const { transcript, contextSongs } = JSON.parse(event.body || '{}');
    if (!transcript || transcript.trim().length === 0) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'No transcript provided' }) };
    }

    const db = await getDb();
    const col = db.collection('songs');

    // Step 1: Use Gemini to parse the intent and extract filters
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const contextStr = contextSongs?.length ? `\n\nContext (recently shown songs):\n${JSON.stringify(contextSongs.map((s,i) => ({ index: i+1, title: s.title, movie: s.movie })))}` : '';

    const intentPrompt = `You are an AI music assistant for an Ilayaraja Tamil film song app.
Parse the following voice command and return a structured JSON intent.

Voice command: "${transcript}"${contextStr}

Return ONLY a raw JSON object (no markdown, no backticks) with this exact structure:
{
  "intent": "PLAY_SONG | LIST_SONGS | RANDOM_SONG | SONG_INFO | UNCLEAR",
  "filters": {
    "title": "song title if mentioned, null otherwise",
    "movie": "film/movie name if mentioned, null otherwise",
    "actors": "actor name if mentioned, null otherwise",
    "singers": "singer name if mentioned, null otherwise",
    "director": "director name if mentioned, null otherwise",
    "year_from": null,
    "year_to": null,
    "decade": "1980s or 1990s etc if mentioned, null otherwise"
  },
  "speech_response": "A short, friendly spoken response to say back to the user (1 sentence)"
}

Intent rules:
- PLAY_SONG: user wants to play a specific song. If they say "play any song from [movie]" without a title, map to LIST_SONGS and ask them to choose. If they say "play the first one", "second one" etc, look at the Context and return the title of that song.
- LIST_SONGS: user wants to browse/list songs (e.g., 'show me', 'list', 'what songs'). Also use this for "play any song from [movie]" so they can pick one.
- RANDOM_SONG: user wants any random song matching optional criteria (unless they specify a movie, then use LIST_SONGS).
- SONG_INFO: user wants info about the currently playing song
- UNCLEAR: cannot understand the command

For decade queries like 'early 1990s' use year_from=1990, year_to=1993. 'Late 1980s' = 1987-1989.
Normalize Tamil film names and song titles to their common English spelling (e.g., 'Nayakhan' -> 'Nayakan', 'Thenpaandi' -> 'Thenpandi').`;

    const intentResult = await model.generateContent(intentPrompt);
    const intentText = intentResult.response.text().replace(/```json/g,'').replace(/```/g,'').trim();
    let parsed;
    try {
      parsed = JSON.parse(intentText);
    } catch (e) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        success: true, intent: 'UNCLEAR', songs: [], song: null,
        speech_response: "Sorry, I didn't quite catch that. Try saying something like: Play Thenpaandi Seemaiyile, or List songs from Nayakan."
      })};
    }

    const { intent, filters, speech_response } = parsed;

    // Step 2: Build MongoDB query from filters
    const buildQuery = (filters) => {
      const query = {};
      const conditions = [];

      if (filters.title) {
        conditions.push({ title: { $regex: filters.title.split(' ').join('|'), $options: 'i' } });
      }
      if (filters.movie) {
        query.movie = { $regex: filters.movie, $options: 'i' };
      }
      if (filters.actors) {
        conditions.push({
          $or: [
            { actors: { $elemMatch: { $regex: filters.actors, $options: 'i' } } },
            { searchable_text: { $regex: filters.actors, $options: 'i' } }
          ]
        });
      }
      if (filters.singers) {
        conditions.push({
          $or: [
            { singers: { $elemMatch: { $regex: filters.singers, $options: 'i' } } },
            { searchable_text: { $regex: filters.singers, $options: 'i' } }
          ]
        });
      }
      if (filters.director) {
        query.director = { $regex: filters.director, $options: 'i' };
      }
      if (filters.decade) {
        query.decade = { $regex: filters.decade, $options: 'i' };
      }
      if (filters.year_from || filters.year_to) {
        query.year = {};
        if (filters.year_from) query.year.$gte = Number(filters.year_from);
        if (filters.year_to) query.year.$lte = Number(filters.year_to);
      }
      if (conditions.length > 0) {
        query.$and = conditions;
      }
      return query;
    };

    const mongoQuery = buildQuery(filters || {});
    const projection = { _id: 0, id: 1, title: 1, movie: 1, year: 1, actors: 1, singers: 1, director: 1, spotify_id: 1 };

    if (intent === 'UNCLEAR' || intent === 'SONG_INFO') {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        success: true, intent, songs: [], song: null, speech_response
      })};
    }

    if (intent === 'PLAY_SONG') {
      let song = await col.findOne(mongoQuery, { projection });
      if (!song && filters?.title) {
        // Fallback: broader title search
        const titleFirstWord = (filters.title || '').split(' ')[0];
        song = await col.findOne(
          { 
            $or: [
              { title: { $regex: titleFirstWord, $options: 'i' } },
              { searchable_text: { $regex: titleFirstWord, $options: 'i' } }
            ]
          },
          { projection }
        );
      }
      if (!song) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          success: true, intent: 'NOT_FOUND', songs: [], song: null,
          speech_response: `Sorry, I couldn't find "${filters?.title || 'that song'}" in our collection.`
        })};
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        success: true, intent: 'PLAY_SONG', song, songs: [],
        speech_response: speech_response || `Now playing ${song.title} from ${song.movie}`
      })};
    }

    if (intent === 'RANDOM_SONG') {
      const matches = await col.find(mongoQuery, { projection }).toArray();
      if (matches.length === 0) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          success: true, intent: 'NOT_FOUND', songs: [], song: null,
          speech_response: "I couldn't find any songs matching that. Try a different filter."
        })};
      }
      const song = matches[Math.floor(Math.random() * matches.length)];
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        success: true, intent: 'PLAY_SONG', song, songs: [],
        speech_response: speech_response || `Here's ${song.title} from ${song.movie}`
      })};
    }

    // LIST_SONGS
    const songs = await col.find(mongoQuery, { projection }).limit(20).toArray();
    if (songs.length === 0) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        success: true, intent: 'NOT_FOUND', songs: [], song: null,
        speech_response: "I couldn't find any songs matching that criteria in our collection."
      })};
    }
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
      success: true, intent: 'LIST_SONGS', song: null, songs,
      speech_response: speech_response || `Found ${songs.length} song${songs.length > 1 ? 's' : ''}. Here they are.`
    })};

  } catch (error) {
    console.error('voiceCommand error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

// ============================================================================
// 19: POST DAILY SOCIALS (SCHEDULED TASK)
// ============================================================================
exports.postDailySocials = async (event) => {
  try {
    const db = await getDb();
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Check if already posted today
    const systemStatusCol = db.collection("system_status");
    const status = await systemStatusCol.findOne({ id: `social_post_${todayStr}` });
    
    if (status && status.posted) {
      console.log(`Already posted socials for ${todayStr}. Skipping.`);
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Already posted today.' }) };
    }
    
    // Fetch today's song using existing handler logic
    const songOfDayResponse = await exports.getSongOfDay({ headers: {}, queryStringParameters: { date: todayStr } });
    
    if (songOfDayResponse.statusCode !== 200) {
      throw new Error(`Failed to fetch song of the day: ${songOfDayResponse.body}`);
    }
    
    const parsedBody = JSON.parse(songOfDayResponse.body);
    const song = parsedBody.song;
    
    if (!song || !song.whatsapp_share_text) {
       throw new Error("No whatsapp_share_text available to post.");
    }
    
    const domain = process.env.DOMAIN_NAME || 'music.uforiansports.com';
    const postText = `${song.whatsapp_share_text}\n\nListen now: https://${domain}/?songId=${song.id}`;
    
    // Post to Twitter
    if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_SECRET_KEY) {
      const { TwitterApi } = require('twitter-api-v2');
      const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY,
        appSecret: process.env.TWITTER_SECRET_KEY,
        accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || '',
      });
      
      const rwClient = twitterClient.readWrite;
      
      try {
        await rwClient.v2.tweet(postText);
        console.log("Successfully posted to Twitter");
      } catch (twitterErr) {
        console.error("Twitter post error:", twitterErr);
        // Fail the lambda so EventBridge can retry or log failure
        throw twitterErr;
      }
    } else {
      console.log("Twitter credentials missing, skipping Twitter post.");
    }
    
    // Mark as posted
    await systemStatusCol.updateOne(
      { id: `social_post_${todayStr}` },
      { $set: { posted: true, postedAt: new Date() } },
      { upsert: true }
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Socials posted successfully.' })
    };
  } catch (error) {
    console.error('Error in postDailySocials:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};


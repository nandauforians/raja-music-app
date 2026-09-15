const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');

const { GoogleGenerativeAI } = require('@google/generative-ai');
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

exports.getArchive = async (event) => {
  try {
    const db = await getDb();
    const scheduleCol = db.collection("schedule");
    const songsCol = db.collection("songs");
    
    // Parse query parameters
    const search = (event.queryStringParameters && event.queryStringParameters.q) ? event.queryStringParameters.q.toLowerCase() : '';
    const today = new Date().toISOString().split('T')[0];
    
    // Get all scheduled songs up to and including today
    const pastSchedules = await scheduleCol.find({ dateISO8601: { $lte: today } }).sort({ dateISO8601: -1 }).toArray();
    
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


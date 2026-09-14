const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { TwitterApi } = require('twitter-api-v2');

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
    
    // Check if today is Tuesday (2) in UTC (which matches 9 AM IST)
    const isTuesday = new Date().getDay() === 2;
    
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
        if (isTuesday) {
          // TUESDAY: Post the real URL using the "Link in Reply" method to maximize reach
          const mainPostText = `${song.whatsapp_share_text}\n\n🎧 Listen to the full track (Link in reply below 👇)`;
          const replyPostText = `Listen now: https://${domain}/?songId=${song.id}`;
          
          const mainTweet = await rwClient.v2.tweet(mainPostText);
          await rwClient.v2.reply(replyPostText, mainTweet.data.id);
          
          console.log("Successfully posted to Twitter (Tuesday: Main + URL Reply)");
        } else {
          // OTHER DAYS: Post a single obfuscated tweet to save API costs
          const obfuscatedPostText = `${song.whatsapp_share_text}\n\n🎧 Listen now: music[dot]uforiansports[dot]com`;
          await rwClient.v2.tweet(obfuscatedPostText);
          
          console.log("Successfully posted to Twitter (Obfuscated Text)");
        }
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

exports.voiceCommand = async (event) => {
  try {
    const { transcript, contextSongs } = JSON.parse(event.body || '{}');
    if (!transcript || transcript.trim().length === 0) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'No transcript provided' }) };
    }

    const db = await getDb();
    const col = db.collection('songs');

    if (!process.env.GEMINI_API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'GEMINI_API_KEY is not configured' }) };
    }

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

    let intent, filters, speech_response;
    try {
      const intentResult = await model.generateContent(intentPrompt);
      const intentText = intentResult.response.text().replace(/```json/g,'').replace(/```/g,'').trim();
      const parsed = JSON.parse(intentText);
      intent = parsed.intent;
      filters = parsed.filters;
      speech_response = parsed.speech_response;
    } catch (e) {
      console.warn('Gemini voiceCommand parsing warning/error, falling back to direct search:', e.message);
      intent = 'PLAY_SONG';
      filters = { title: transcript };
      speech_response = `Searching for "${transcript}"`;
    }

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


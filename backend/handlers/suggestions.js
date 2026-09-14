const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');

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


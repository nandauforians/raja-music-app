const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');

const { addSong } = require('./songs');

exports.suggestSong = async (event) => {
  try {
    const { userId, userName, submittedBy, spotifyId, youtubeUrl, title, movie, year, previewUrl, albumCoverUrl } = JSON.parse(event.body || '{}');
    if (!spotifyId && !title && !youtubeUrl) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing song details (spotifyId, youtubeUrl, or title)' }) };

    const db = await getDb();
    
    // Check if song is already in DB
    const checkQueries = [];
    if (spotifyId) checkQueries.push({ spotify_id: spotifyId });
    if (title) checkQueries.push({ title });
    if (youtubeUrl) checkQueries.push({ youtube_url: youtubeUrl });

    if (checkQueries.length > 0) {
      const existing = await db.collection('songs').findOne({ $or: checkQueries });
      if (existing) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Song already exists in the catalog.' }) };
      }
    }

    // Check if suggestion already exists
    const suggQueries = [];
    if (spotifyId) suggQueries.push({ spotifyId });
    if (title) suggQueries.push({ title });
    if (youtubeUrl) suggQueries.push({ youtubeUrl });

    if (suggQueries.length > 0) {
      const existingSugg = await db.collection('song_suggestions').findOne({ $or: suggQueries, status: 'pending' });
      if (existingSugg) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'This song has already been suggested and is pending review.' }) };
      }
    }

    const finalUserId = userId || 'anonymous';
    const finalUserName = (userName && userName.trim()) || (submittedBy && submittedBy.trim()) || 'Anonymous User';

    const suggestion = {
      _id: new (require('mongodb').ObjectId)(),
      userId: finalUserId,
      userName: finalUserName,
      submittedBy: finalUserName,
      spotifyId: spotifyId || '',
      youtubeUrl: youtubeUrl || '',
      title: title || 'Untitled Suggestion',
      movie: movie || '',
      year: year || '',
      previewUrl: previewUrl || '',
      albumCoverUrl: albumCoverUrl || '',
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

    const addEvent = {
      body: JSON.stringify({
        title: suggestion.title,
        movie: suggestion.movie,
        year: suggestion.year,
        spotify_id: suggestion.spotifyId || '',
        youtube_url: suggestion.youtubeUrl || '',
        preview_url: suggestion.previewUrl,
        album_cover_url: suggestion.albumCoverUrl
      }),
      headers: event.headers,
      requestContext: { authorizer: { principalId: 'admin' } }
    };
    const addRes = await addSong(addEvent);
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


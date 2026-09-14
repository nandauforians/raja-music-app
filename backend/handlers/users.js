const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');

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


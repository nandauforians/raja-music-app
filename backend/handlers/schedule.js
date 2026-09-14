const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');

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


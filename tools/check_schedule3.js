require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(); // Use default from URI
    
    const todayStr = new Date('2026-09-09T00:00:00Z').toISOString().split('T')[0];
    console.log("Looking for schedule on:", todayStr);
    const scheduleCol = db.collection('schedule');
    const schedule = await scheduleCol.findOne({ dateISO8601: todayStr });
    
    if (schedule) {
      console.log(`Scheduled song for today: songId = ${schedule.song_id}`);
      const song = await db.collection('songs').findOne({ id: String(schedule.song_id) });
      if (song) {
        console.log(`Song Title: ${song.title}`);
        console.log(`Has Synced Lyrics: ${!!song.synced_lyrics}`);
        if (song.synced_lyrics) {
            console.log(song.synced_lyrics.slice(0, 300));
        }
      }
    } else {
        console.log("No schedule found for today. Let's find the latest schedule:");
        const latest = await scheduleCol.find({}).sort({ dateISO8601: -1 }).limit(1).toArray();
        console.log(latest);
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);

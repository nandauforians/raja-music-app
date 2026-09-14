require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI");
    return;
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('ilayaraja_music');
    const scheduleCol = db.collection('schedule');
    const songsCol = db.collection('songs');
    
    // Find today's song
    const todayStr = new Date('2026-09-09T00:00:00Z').toISOString().split('T')[0];
    const schedule = await scheduleCol.findOne({ date: todayStr });
    
    if (schedule) {
      console.log(`Scheduled song for today (${todayStr}): songId = ${schedule.song_id}`);
      const song = await songsCol.findOne({ id: schedule.song_id });
      if (song) {
        console.log(`Song Title: ${song.title}`);
        console.log(`Karaoke URL: ${song.karaoke_url}`);
        console.log(`Has Synced Lyrics: ${!!song.synced_lyrics}`);
        if (song.synced_lyrics) {
            console.log(`First 5 lines of synced lyrics:\n${song.synced_lyrics.split('\n').slice(0, 5).join('\n')}`);
        }
      } else {
        console.log(`Song not found for ID ${schedule.song_id}`);
      }
    } else {
      console.log("No schedule found for today");
    }
    
  } finally {
    await client.close();
  }
}

check().catch(console.error);

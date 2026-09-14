require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const scheduleCol = db.collection('schedule');
    const schedule = await scheduleCol.find({
        dateISO8601: { $in: ["2026-09-08", "2026-09-09", "2026-09-10"] }
    }).toArray();
    
    for (const s of schedule) {
        console.log(`${s.dateISO8601}: songId = ${s.song_id}`);
        const song = await db.collection('songs').findOne({ id: String(s.song_id) });
        if (song) {
            console.log(` - ${song.title}, Has Synced Lyrics: ${!!song.synced_lyrics}`);
            if (song.synced_lyrics) {
                console.log(song.synced_lyrics.slice(0, 100));
            }
        }
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);

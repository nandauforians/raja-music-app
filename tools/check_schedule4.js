require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const scheduleCol = db.collection('schedule');
    const schedule = await scheduleCol.find({}).sort({ dateISO8601: 1 }).toArray();
    
    for (const s of schedule) {
        const song = await db.collection('songs').findOne({ id: String(s.song_id) });
        if (song && song.synced_lyrics) {
            console.log(`${s.dateISO8601}: songId = ${s.song_id} - ${song.title}`);
        }
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);

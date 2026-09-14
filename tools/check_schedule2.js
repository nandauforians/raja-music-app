require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('ilayaraja_music');
    const scheduleCol = db.collection('schedule');
    
    const all = await scheduleCol.find({}).sort({ dateISO8601: 1 }).toArray();
    console.log(`Total scheduled dates: ${all.length}`);
    for (let i = 0; i < Math.min(10, all.length); i++) {
        console.log(`${all[i].dateISO8601} / ${all[i].date}: songId = ${all[i].song_id}`);
    }
    
    // Find song scheduled today:
    const today = new Date('2026-09-09T00:00:00Z');
    // Maybe just search around this date
  } finally {
    await client.close();
  }
}
check().catch(console.error);

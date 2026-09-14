require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('ilayaraja_music');
    const scheduleCol = db.collection('schedule');
    
    const all = await scheduleCol.find({}).sort({date: 1}).toArray();
    console.log(`Total scheduled dates: ${all.length}`);
    for (let i = 0; i < Math.min(10, all.length); i++) {
        console.log(`${all[i].date}: songId = ${all[i].song_id}`);
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);

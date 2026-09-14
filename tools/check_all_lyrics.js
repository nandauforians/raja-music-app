require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const songs = await db.collection('songs').find({ synced_lyrics: { $exists: true } }).toArray();
    console.log(`Songs with lyrics: ${songs.length}`);
    for (const song of songs) {
        console.log(`- ${song.id}: ${song.title}`);
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);

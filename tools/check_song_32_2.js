require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('ilayaraja_music');
    const song = await db.collection('songs').findOne({ id: "32" });
    if (song) {
        console.log("Lyrics:");
        console.log(song.synced_lyrics);
        console.log("Is string?", typeof song.synced_lyrics);
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);

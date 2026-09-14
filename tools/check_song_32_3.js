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
        console.log("Song found.");
        console.log("Has synced lyrics:", !!song.synced_lyrics);
        if (song.synced_lyrics) {
            console.log(song.synced_lyrics);
        }
    } else {
        console.log("Song 32 not found");
    }
  } catch (e) {
      console.error(e);
  } finally {
    await client.close();
  }
}
check();

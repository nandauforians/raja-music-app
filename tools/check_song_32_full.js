require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const song = await db.collection('songs').findOne({ id: "32" });
    if (song) {
        console.log(Object.keys(song));
        if (song.lyrics) {
            console.log("Has lyrics field!");
        }
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);

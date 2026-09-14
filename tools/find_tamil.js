require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    // Tamil Unicode block is \u0B80-\u0BFF
    const tamilRegex = /[\u0B80-\u0BFF]/;
    
    const songs = await db.collection('songs').find({
        synced_lyrics: { $regex: tamilRegex }
    }).toArray();
    
    console.log(`Found ${songs.length} songs with Tamil lyrics:`);
    for (const s of songs) {
        console.log(`- ID: ${s.id}, Title: ${s.title}`);
        console.log(s.synced_lyrics.split('\n')[0]);
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);

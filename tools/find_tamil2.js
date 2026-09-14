require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const songs = await db.collection('songs').find({
        synced_lyrics: { $exists: true, $ne: "" }
    }).toArray();
    
    const tamilRegex = /[\u0B80-\u0BFF]/;
    
    const tamilSongs = songs.filter(s => tamilRegex.test(s.synced_lyrics));
    console.log(`Found ${tamilSongs.length} songs with Tamil lyrics:`);
    for (const s of tamilSongs) {
        console.log(`- ID: ${s.id}, Title: ${s.title}`);
        console.log(s.synced_lyrics.split('\n').slice(0, 3).join('\n'));
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);

const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    
    const missingOriginals = await db.collection('songs').find({
      original_url: { $exists: false },
      youtube_url: { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`Found ${missingOriginals.length} total songs in the DB missing original_url.`);
    if (missingOriginals.length > 0 && missingOriginals.length < 20) {
       console.log("IDs:", missingOriginals.map(s => s.id).join(', '));
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

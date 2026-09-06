const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    
    // Find all listen_full activities
    const listens = await db.collection('activities').find({ action: 'listen_full' }).toArray();
    console.log(`Found ${listens.length} full listens.`);
    
    let updated = 0;
    for (const act of listens) {
      if (act.songId) {
        await db.collection('songs').updateOne(
          { id: act.songId },
          { $inc: { totalPlaySeconds: 300, fullListens: 1 } }
        );
        updated++;
      }
    }
    
    console.log(`Successfully backfilled ${updated} listen records.`);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

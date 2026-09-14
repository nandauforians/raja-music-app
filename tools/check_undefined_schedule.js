const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    
    const badSchedule = await db.collection('schedule').find({ songId: { $in: [null, undefined, "undefined"] } }).toArray();
    console.log(`Found ${badSchedule.length} bad schedule items:`, JSON.stringify(badSchedule, null, 2));
    
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

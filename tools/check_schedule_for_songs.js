const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0';
async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const schedule = await db.collection('schedule').find({ songId: { $in: ["43", "47", "157"] } }).toArray();
    for (const item of schedule) {
      console.log(`Song ${item.songId} scheduled for ${item.dateISO8601}`);
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

const { MongoClient } = require('mongodb');
async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const acts = await db.collection('activities').find({ userId: "104358921770012536742" }).toArray();
    console.log(acts);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

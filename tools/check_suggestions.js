const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0';
async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const suggs = await db.collection('song_suggestions').find({}).toArray();
    console.log("Suggestions:", JSON.stringify(suggs, null, 2));
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

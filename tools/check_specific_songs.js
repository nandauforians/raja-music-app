const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0';
async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const songs = await db.collection('songs').find({ id: { $in: ["43", "47", "157"] } }).toArray();
    for (const song of songs) {
      console.log(`Song ${song.id}: original_url=${song.original_url}, karaoke_url=${song.karaoke_url}`);
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

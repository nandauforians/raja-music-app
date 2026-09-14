const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const song = await db.collection('songs').findOne({ id: "51" });
    console.log("--- TAMIL ---");
    console.log(song.synced_lyrics_tamil);
    console.log("--- TANGLISH ---");
    console.log(song.synced_lyrics_tanglish);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

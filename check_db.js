const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || "mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db("raja-music-db");
  const song = await db.collection("songs").findOne({ id: "25" });
  console.log("Song 25 synced_lyrics starts with:");
  console.log(song.synced_lyrics ? song.synced_lyrics.substring(0, 100) : "NO LYRICS");
  
  // also check if any other song has id 25 (number)
  const songNum = await db.collection("songs").findOne({ id: 25 });
  console.log("Song 25 (number) found:", !!songNum);
  
  await client.close();
}
run().catch(console.dir);

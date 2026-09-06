const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || "mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db("raja-music-db");
  const song = await db.collection("songs").findOne({ id: "97" });
  console.log("Song 97:", song ? song.title : "Not found");
  
  const song25 = await db.collection("songs").findOne({ id: "25" });
  console.log("Song 25:", song25 ? song25.title : "Not found");
  await client.close();
}
run().catch(console.dir);

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || "mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db("raja-music-db");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  
  await db.collection("schedule").updateOne(
    { song_id: "25" },
    { $set: { song_id: "25", dateISO8601: dateStr, karaoke_enabled: true } },
    { upsert: true }
  );
  console.log("Scheduled song 25 for " + dateStr);
  await client.close();
}
run().catch(console.dir);

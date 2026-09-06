const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || "mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db("raja-music-db");
  const songsCol = db.collection("songs");
  
  const songs = await songsCol.find({ fullListens: { $exists: true } }).toArray();
  for (const song of songs) {
    if (song.totalPlaySeconds > 0) {
      // average song is around 4.5 mins = 270 seconds. 80% is ~216 seconds.
      // we'll recalculate fullListens based on totalPlaySeconds / 216
      const realisticFullListens = Math.floor(song.totalPlaySeconds / 216);
      
      // if the current fullListens is vastly higher than realistic, we fix it
      if (song.fullListens > realisticFullListens) {
        await songsCol.updateOne(
          { id: song.id },
          { $set: { fullListens: realisticFullListens } }
        );
        console.log(`Fixed ${song.title}: reduced from ${song.fullListens} to ${realisticFullListens}`);
      }
    }
  }
  console.log("Leaderboard fixed.");
  await client.close();
}
run().catch(console.dir);

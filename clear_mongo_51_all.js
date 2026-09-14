const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const songs = db.collection('songs');
    const result = await songs.updateOne(
      { id: "51" },
      { $unset: { 
          original_url: "", 
          karaoke_url: "", 
          synced_lyrics_tamil: "", 
          synced_lyrics_tanglish: "", 
          pitch_data_url: "",
          karaoke_snippet_start: "",
          karaoke_snippet_end: "",
          synced_lyrics: "" 
        } 
      }
    );
    console.log("Matched:", result.matchedCount, "Modified:", result.modifiedCount);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

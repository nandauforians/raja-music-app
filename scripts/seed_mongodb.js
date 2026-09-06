const { MongoClient } = require('mongodb');
const fs = require('fs');

const uri = process.env.MONGODB_URI || "mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    
    const db = client.db("raja-music-db");
    const songsCollection = db.collection("songs");
    
    // Read local data
    const dbPath = './ilayaraja_songs_database.json';
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const songs = data.songs;
    
    console.log(`Found ${songs.length} songs in local JSON.`);
    
    // Clear existing data (optional, but good for seeding)
    console.log("Clearing existing songs collection...");
    await songsCollection.deleteMany({});
    
    // Insert new data
    console.log("Inserting songs into MongoDB...");
    const result = await songsCollection.insertMany(songs);
    
    console.log(`✅ Success! Inserted ${result.insertedCount} songs into MongoDB Atlas.`);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);

const { MongoClient } = require('mongodb');

async function fixIds() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("No MONGODB_URI in .env");
  
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('raja-music-db');
  
  const allSongs = await db.collection("songs").find({}).toArray();
  
  let maxId = 0;
  for (const song of allSongs) {
    const numId = parseInt(song.id, 10);
    if (!isNaN(numId) && numId > maxId) {
      maxId = numId;
    }
  }
  
  console.log(`Current max numeric ID is ${maxId}`);
  
  const badSongs = allSongs.filter(s => s.id && s.id.startsWith('song_'));
  console.log(`Found ${badSongs.length} songs needing fix.`);
  
  for (const song of badSongs) {
    maxId++;
    const oldId = song.id;
    const newId = String(maxId);
    
    console.log(`Updating ${oldId} -> ${newId} (${song.title})`);
    
    // Update song
    await db.collection("songs").updateOne(
      { _id: song._id },
      { $set: { id: newId } }
    );
    
    // Update schedule
    const result = await db.collection("schedule").updateMany(
      { song_id: oldId },
      { $set: { song_id: newId } }
    );
    
    console.log(` - Updated ${result.modifiedCount} schedule entries.`);
  }
  
  console.log("Done.");
  await client.close();
}

fixIds().catch(console.error);

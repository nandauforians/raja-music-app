const { MongoClient } = require('mongodb');
const { execSync } = require('child_process');
const uri = 'mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    
    const now = new Date();
    const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    
    const schedule = await db.collection('schedule').find({
      dateISO8601: { $gte: now.toISOString().split('T')[0], $lte: tenDaysFromNow.toISOString().split('T')[0] }
    }).toArray();
    
    const songIdsToProcess = new Set(["43", "47"]);
    for (const item of schedule) {
      if (item.song_id) {
        songIdsToProcess.add(item.song_id);
      }
    }
    
    const idsArray = Array.from(songIdsToProcess);
    console.log(`Processing ${idsArray.length} songs:`, idsArray.join(', '));
    
    for (const id of idsArray) {
      console.log(`\n============================`);
      console.log(`Running pipeline for Song ${id}...`);
      try {
        execSync(`python3 scripts/generate_karaoke.py --song-id ${id}`, { stdio: 'inherit' });
        console.log(`Success for Song ${id}`);
      } catch (err) {
        console.error(`Failed to process Song ${id}`);
      }
    }
    
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

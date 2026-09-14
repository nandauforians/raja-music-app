const { MongoClient } = require('mongodb');
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
    
    console.log(`Found ${schedule.length} scheduled songs in the next 10 days.`);
    
    const missingOriginals = [];
    for (const item of schedule) {
      const song = await db.collection('songs').findOne({ id: item.songId });
      if (song) {
        if (!song.original_url && song.youtube_url) {
          missingOriginals.push(song.id);
        }
      }
    }
    
    console.log("Song IDs missing original_url:", missingOriginals);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

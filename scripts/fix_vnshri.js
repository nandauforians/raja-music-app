const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    
    const userId = '102063152027743985185';
    
    const activities = [
      { userId, action: 'listen_full', date: '2026-08-29', points: 250, songId: '1', timestamp: new Date() },
      { userId, action: 'spotify_add', date: '2026-08-29', points: 250, songId: '1', timestamp: new Date() },
      { userId, action: 'listen_full', date: '2026-08-27', points: 250, songId: 'bonus_1', timestamp: new Date('2026-08-27T12:00:00Z') },
      { userId, action: 'listen_full', date: '2026-08-28', points: 250, songId: 'bonus_2', timestamp: new Date('2026-08-28T12:00:00Z') }
    ];
    
    await db.collection('activities').insertMany(activities);
    
    await db.collection('users').updateOne(
      { userId },
      { 
        $set: { totalPoints: 1050, hasJoiningBonus: true }
      }
    );
    
    console.log("Successfully fixed vnshri15 data. She now has 1050 points.");
    
  } finally {
    await client.close();
  }
}
run().catch(console.error);

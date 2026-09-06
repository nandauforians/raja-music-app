const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    
    const userId = '102063152027743985185'; // Shridevi Nandakumar
    
    const user = await db.collection('users').findOne({ userId });
    console.log("User:", user);
    
    const activities = await db.collection('activities').find({ userId }).toArray();
    console.log("Activities:", activities);
  } finally {
    await client.close();
  }
}
run().catch(console.error);

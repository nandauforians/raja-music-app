const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI found.");
    return;
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const users = await db.collection('users').find({}).toArray();
    console.log("Users in DB:");
    console.dir(users, { depth: null });
    
    const anonUsers = users.filter(u => !u.name || u.name === 'Anonymous User');
    if (anonUsers.length > 0) {
      const anonIds = anonUsers.map(u => u.userId);
      const activities = await db.collection('activities').find({ userId: { $in: anonIds } }).toArray();
      console.log("\nActivities for Anonymous Users:");
      console.dir(activities, { depth: null });
    }
  } finally {
    await client.close();
  }
}
run().catch(console.error);

const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    
    // Find the user by email
    const users = await db.collection('users').find({ email: 'vnshri15@gmail.com' }).toArray();
    console.log("Users:", users);
    
    if (users.length > 0) {
      const activities = await db.collection('activities').find({ userId: users[0].userId }).toArray();
      console.log("Activities:", activities);
    } else {
        // Just print all users to see if email is stored
        const allUsers = await db.collection('users').find({}).toArray();
        console.log("All users:", allUsers.map(u => ({ id: u.userId, name: u.name, email: u.email, points: u.totalPoints })));
    }
  } finally {
    await client.close();
  }
}
run().catch(console.error);

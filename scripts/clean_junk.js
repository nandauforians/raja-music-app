const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    
    const userId = '115080737971543422165';
    
    const delUser = await db.collection('users').deleteOne({ userId });
    console.log(`Deleted ${delUser.deletedCount} user(s).`);
    
    const delAct = await db.collection('activities').deleteMany({ userId });
    console.log(`Deleted ${delAct.deletedCount} activity(ies).`);
    
  } finally {
    await client.close();
  }
}
run().catch(console.error);

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI in environment");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function backfillRagas() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const songs = db.collection('songs');
    
    // Find songs that don't have a raga yet
    const cursor = songs.find({ raga: { $exists: false } });
    const allSongs = await cursor.toArray();
    
    console.log(`Found ${allSongs.length} songs missing raga classification.`);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    for (let i = 0; i < allSongs.length; i++) {
      const song = allSongs[i];
      console.log(`[${i+1}/${allSongs.length}] Classifying: ${song.title} from ${song.movie}...`);
      
      const prompt = `Ilayaraja based many of his songs on Carnatic ragas. 
What Carnatic raga is the Tamil song "${song.title}" from the movie "${song.movie}" (composed by Ilayaraja) primarily based on?
If it is a famous raga, reply with ONLY the name of the raga (e.g. "Kalyani", "Sindhu Bhairavi", "Mohanam", "Hamsadhvani").
If it's not strictly based on a single Carnatic raga, or it's purely western/folk and unknown, reply with "Unknown" or "Western/Folk".
Do not include any explanation or extra text. Reply with just the Raga name.`;

      try {
        const result = await model.generateContent(prompt);
        const raga = result.response.text().trim();
        
        console.log(`    -> Raga: ${raga}`);
        
        await songs.updateOne({ _id: song._id }, { $set: { raga } });
        
        // Sleep for 1 second to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`    -> Error classifying ${song.title}:`, err.message);
      }
    }
    
    console.log("Raga backfill complete!");
  } finally {
    await client.close();
  }
}

backfillRagas().catch(console.error);

require('dotenv').config({path: '../.env'});
const { MongoClient } = require('mongodb');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI in environment");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function backfillLyrics() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const songs = db.collection('songs');
    
    // Find songs that don't have lyrics
    const cursor = songs.find({ $or: [{ lyrics: { $exists: false } }, { lyrics: "" }] });
    const allSongs = await cursor.toArray();
    
    console.log(`Found ${allSongs.length} songs missing lyrics.`);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    for (let i = 0; i < allSongs.length; i++) {
      const song = allSongs[i];
      console.log(`[${i+1}/${allSongs.length}] Generating lyrics for: ${song.title} from ${song.movie}...`);
      
      const prompt = `Provide the complete lyrics for the Tamil song "${song.title}" from the movie "${song.movie}" (composed by Ilaiyaraaja).
Output your response STRICTLY as a JSON object with two keys:
1. "tanglish": The lyrics written in the English alphabet.
2. "tamil": The lyrics written in the native Tamil script.
Do NOT include any extra text, markdown formatting blocks (like \`\`\`json), introductions, or explanations. Just the raw JSON object.`;

      try {
        const result = await model.generateContent(prompt);
        let rawText = result.response.text().trim();
        rawText = rawText.replace(/^```[a-z]*\n/gm, '').replace(/```$/gm, '').trim();
        
        const data = JSON.parse(rawText);
        
        console.log(`    -> Generated Tanglish (${data.tanglish?.length || 0} chars) & Tamil (${data.tamil?.length || 0} chars)`);
        
        await songs.updateOne({ _id: song._id }, { $set: { lyrics: data.tanglish, lyrics_tamil: data.tamil } });
        
        // Sleep for 2 seconds to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`    -> Error generating lyrics for ${song.title}:`, err.message);
      }
    }
    
    console.log("Lyrics backfill complete!");
  } finally {
    await client.close();
  }
}

backfillLyrics().catch(console.error);

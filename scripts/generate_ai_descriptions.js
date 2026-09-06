const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Usage: GEMINI_API_KEY=your_key node scripts/generate_ai_descriptions.js
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Please provide GEMINI_API_KEY as an environment variable.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const dbPath = './ilayaraja_songs_database.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

async function processSongs() {
  let updatedCount = 0;
  
  for (let i = 0; i < db.songs.length; i++) {
    const song = db.songs[i];
    
    if (song.spotify_id && !song.gemini_trivia) {
      console.log(`Generating description for: ${song.title} (${song.movie})...`);
      
      const prompt = `Write a 100-200 word beautiful, engaging description about the song "${song.title}" from the Tamil movie "${song.movie}" composed by Ilaiyaraaja. Explicitly mention the type of song (e.g. romantic, melancholic, folk) and the specific Carnatic ragas used in its composition. Do not use any markdown formatting, just plain text.`;
      
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        song.gemini_trivia = text;
        updatedCount++;
        console.log(`✅ Success`);
        
        // Save incrementally
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        fs.writeFileSync('./frontend/src/ilayaraja_songs_database.json', JSON.stringify(db, null, 2));
        
        if (updatedCount >= 10) {
          console.log("Reached limit of 10 songs. Stopping.");
          break;
        }

        // Wait 3 seconds to avoid rate limits
        await new Promise(r => setTimeout(r, 3000));
      } catch (error) {
        console.error(`❌ Failed:`, error.message);
      }
    }
  }
  
  console.log(`\nDone! Added AI descriptions to ${updatedCount} songs.`);
}

processSongs();

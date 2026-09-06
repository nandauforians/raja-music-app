import fs from 'fs';
import path from 'path';

// Run with: GEMINI_API_KEY=your_key node scripts/fetch_songs.js
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const BATCH_SIZE = 50; 

async function fetchSongsFromGemini() {
  if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    process.exit(1);
  }

  console.log(`Fetching ${BATCH_SIZE} songs from Gemini API...`);

  const prompt = `
Generate a JSON array of ${BATCH_SIZE} iconic Ilaiyaraaja Tamil songs.
Each object must have the following keys:
- "id": string (unique identifier, e.g., "1", "2")
- "title": string (song title)
- "movie": string (movie name)
- "year": number (release year)
- "decade": string (e.g. "1980s")
- "category": string (e.g., "Romantic", "Pathos", "Folk", "Classical", "Energetic")
- "singers": array of strings
- "description": string (a 1-sentence trivia or musical highlight about the song)
- "spotify_id": string (leave as empty string "")

Only return valid JSON. Do not include markdown blocks. Ensure the data is highly accurate and the movie matches the song.
`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const textContent = data.candidates[0].content.parts[0].text;
    
    // Parse the JSON array
    const songs = JSON.parse(textContent);
    
    // Read and update existing database
    const dbPath = path.join(process.cwd(), 'ilayaraja_songs_database.json');
    let db = { metadata: {}, songs: [] };
    
    if (fs.existsSync(dbPath)) {
      db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }

    // Assign new IDs based on existing length
    const startId = db.songs.length > 0 ? Math.max(...db.songs.map(s => parseInt(s.id))) + 1 : 1;
    songs.forEach((song, index) => {
      song.id = (startId + index).toString();
    });
    
    db.songs = [...db.songs, ...songs];
    db.metadata = {
      ...db.metadata,
      totalSongs: db.songs.length,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log(`✅ Successfully fetched and added ${songs.length} songs!`);
    console.log(`Database now has ${db.songs.length} songs.`);
    
  } catch (error) {
    console.error("❌ Failed to fetch songs:", error.message);
  }
}

fetchSongsFromGemini();

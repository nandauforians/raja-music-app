const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const audioData = fs.readFileSync("/Users/nanda/code/raja-music-app/karaoke_source/archive/2026-08-27_25.m4a");
  
  const prompt = "Listen to this song and provide the lyrics in LRC format. The lyrics are in Tamil (Tamil script or transliterated, preferably transliterated Tanglish). Include accurate timestamps for each line like [00:15.22] line of lyrics. Only output the raw LRC format, no markdown or other text.";
  
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "audio/mp4",
        data: audioData.toString("base64")
      }
    },
    prompt
  ]);
  
  console.log(result.response.text());
}
run();

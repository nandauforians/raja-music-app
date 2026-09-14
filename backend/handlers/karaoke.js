const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');

const { s3, getS3SignedUrl, PutObjectCommand, GetObjectCommand, RECORDINGS_BUCKET } = require('../utils/s3');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegStatic);

exports.getKaraokeUploadUrl = async (event) => {
  try {
    await verifyAdminToken(event);
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl: getS3SignedUrl } = require('@aws-sdk/s3-request-presigner');

    const songId = event.queryStringParameters?.songId;
    const ext = (event.queryStringParameters?.ext || 'mp3').toLowerCase();
    if (!songId) throw new Error('songId is required');

    const contentTypeMap = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'mp4a': 'audio/mp4',
      'aac': 'audio/aac',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
    };
    const contentType = contentTypeMap[ext] || 'audio/mpeg';

    // For source files (non-mp3), store with original extension under "source/" prefix
    // The processed karaoke mp3 will be stored at {songId}.mp3 after Demucs runs
    const key = ext === 'mp3' ? `${songId}.mp3` : `source/${songId}.${ext}`;

    const s3 = new S3Client({ region: 'us-east-1' });
    const command = new PutObjectCommand({
      Bucket: 'uforian-karaoke-tracks',
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getS3SignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `https://uforian-karaoke-tracks.s3.us-east-1.amazonaws.com/${key}`;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, uploadUrl, publicUrl, key, ext })
    };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.updateKaraokeUrl = async (event) => {
  try {
    await verifyAdminToken(event);
    const songId = event.pathParameters?.id;
    const body = JSON.parse(event.body || '{}');
    const { karaoke_url, original_url, karaoke_snippet_start, karaoke_snippet_end } = body;

    if (!songId) throw new Error('songId is required');

    const updateFields = {};
    if (karaoke_url !== undefined) updateFields.karaoke_url = karaoke_url;
    if (original_url !== undefined) updateFields.original_url = original_url;
    if (karaoke_snippet_start !== undefined) updateFields.karaoke_snippet_start = parseInt(karaoke_snippet_start, 10);
    if (karaoke_snippet_end !== undefined) updateFields.karaoke_snippet_end = parseInt(karaoke_snippet_end, 10);

    const db = await getDb();
    const songs = db.collection('songs');
    await songs.updateOne({ id: songId }, { $set: updateFields });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.scoreVocal = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { audioBase64, mimeType, songId, userId, userName, userPicture, pitchAccuracy } = body;

    if (!audioBase64 || !songId) {
      throw new Error('Missing audio or songId');
    }

    const db = await getDb();
    const songs = db.collection('songs');
    const song = await songs.findOne({ id: songId });
    if (!song) throw new Error('Song not found');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a trained classical playback singer and a strict but constructive talent show judge (like K. S. Chithra or Mano).
I am providing you with an audio recording of a user singing karaoke to the Ilayaraja song "${song.title}" from the movie ${song.movie}.
Here are the lyrics they are singing:
---
${song.lyrics || "No lyrics provided, please judge based on pitch and melody."}
---
The user's mathematical pitch accuracy score compared to the original singer is ${pitchAccuracy || 'unknown'}%.

Please analyze their vocal performance technically and objectively. 
Do not be overly dramatic or enthusiastic. Provide grounded, technical feedback on their pitch, rhythm, breath control, and expression. Use the provided pitch accuracy score to inform your judgment.
Return your judgment strictly as a JSON object with three fields:
1. "score": an integer from 0 to 100.
2. "brief_summary": a short, technical, 1-2 sentence feedback (e.g. "Good pitch control, but watch your breath support on the higher notes.").
3. "detailed_summary": A comprehensive Markdown breakdown covering Pitch Accuracy, Timing & Rhythm, Breath & Dynamics, and Technical Suggestions for Improvement.

Do NOT return markdown formatting like \`\`\`json, just the raw JSON text.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType || 'audio/webm'
        }
      },
      prompt
    ]);

    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    let scoreData;
    try {
      scoreData = JSON.parse(text);
      // Map 'feedback' back to 'brief_summary' in case the AI uses the old key
      if (scoreData.feedback && !scoreData.brief_summary) {
          scoreData.brief_summary = scoreData.feedback;
      }
    } catch (e) {
      console.error("Failed to parse Gemini response:", text);
      scoreData = { 
          score: 75, 
          brief_summary: "Great effort, but the AI couldn't quite score it. Keep practicing!",
          detailed_summary: "### AI Processing Error\nWe couldn't generate a detailed report for this performance. Please try again!"
      };
    }

    if (userId) {
      // Only upsert the user profile details, don't update scores here.
      // Score updating is moved to saveRecording to enforce 1 submission per song.
      const users = db.collection('users');
      await users.updateOne(
        { userId },
        { 
          $set: { 
            ...(userName && { name: userName }),
            ...(userPicture && { picture: userPicture })
          }
        },
        { upsert: true }
      );
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        score: scoreData.score, 
        feedback: scoreData.brief_summary, 
        detailed_summary: scoreData.detailed_summary 
      })
    };
  } catch (error) {
    console.error("Scoring error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.convertToMp3 = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { audioBase64 } = body;

    if (!audioBase64) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'No audio provided' }) };
    }

    const os = require('os');
    const crypto = require('crypto');
    const tempId = crypto.randomBytes(16).toString('hex');
    const inputPath = path.join(os.tmpdir(), `${tempId}.webm`);
    const outputPath = path.join(os.tmpdir(), `${tempId}.mp3`);

    // Write input base64 to temp file
    const buffer = Buffer.from(audioBase64.split(',')[1] || audioBase64, 'base64');
    fs.writeFileSync(inputPath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .on('error', (err) => {
          console.error('An error occurred during mp3 conversion: ' + err.message);
          reject(err);
        })
        .on('end', () => {
          resolve();
        })
        .save(outputPath);
    });

    // Read back MP3 and convert to base64
    const mp3Buffer = fs.readFileSync(outputPath);
    const mp3Base64 = `data:audio/mp3;base64,${mp3Buffer.toString('base64')}`;

    // Clean up temp files
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (e) {
      console.error('Failed to cleanup temp files', e);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, audioBase64: mp3Base64 })
    };
  } catch (error) {
    console.error("Conversion error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.pitchProxy = async (event) => {
  try {
    const songId = event.queryStringParameters?.songId;
    if (!songId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'songId required' }) };
    }

    const bucket = 'uforian-karaoke-tracks';
    const key = `pitch_data_${songId}.json`;

    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: 'us-east-1' });

    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await s3.send(command);
      const str = await response.Body.transformToString();
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=3600',
        },
        body: str,
      };
    } catch (s3Error) {
      console.error('S3 Fetch Error in pitchProxy:', s3Error);
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Pitch data not found in S3 bucket' }) };
    }
  } catch (e) {
    console.error('pitchProxy error:', e);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: e.message }) };
  }
};

exports.saveRecording = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, songId, audioBase64 } = body;
    if (!userId || !songId || !audioBase64) throw new Error('Missing params');

    const today = new Date().toISOString().split('T')[0];
    const key = `recordings/${userId}/${today}_${songId}.webm`;

    const buffer = Buffer.from(audioBase64, 'base64');

    await s3.send(new PutObjectCommand({
      Bucket: RECORDINGS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'audio/webm'
    }));

    const db = await getDb();
    const newScore = body.score || 0;
    
    // Enforce 1 submission per song rule: check if they already have a recording for this song
    const existingRecording = await db.collection('recordings').findOne({ userId, songId });
    
    if (existingRecording) {
      const oldScore = existingRecording.score || 0;
      const scoreDiff = newScore - oldScore;
      
      await db.collection('recordings').updateOne(
        { _id: existingRecording._id },
        { $set: { s3Key: key, score: newScore, timestamp: new Date().toISOString() } }
      );
      
      if (scoreDiff !== 0) {
        await db.collection('users').updateOne(
          { userId },
          { $inc: { totalKaraokeRating: scoreDiff } }
        );
      }
    } else {
      const recordingDoc = {
        userId,
        songId,
        s3Key: key,
        score: newScore,
        timestamp: new Date().toISOString()
      };
      await db.collection('recordings').insertOne(recordingDoc);
      
      await db.collection('users').updateOne(
        { userId },
        { $inc: { totalKaraokeRating: newScore, karaokeCount: 1 } },
        { upsert: true }
      );
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, s3Key: key }) };
  } catch (error) {
    console.error('Save recording error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.getUserRecordings = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing userId' }) };

    const db = await getDb();
    const recordings = await db.collection('recordings')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    // Fetch song titles from the songs collection to enrich the response
    const songIds = [...new Set(recordings.map(r => r.songId))];
    const songs = await db.collection('songs').find({ id: { $in: songIds } }).toArray();
    const songMap = {};
    songs.forEach(s => songMap[s.id] = s.title);

    // Generate Presigned URLs
    const enrichedRecordings = await Promise.all(recordings.map(async (r) => {
      const command = new GetObjectCommand({
        Bucket: RECORDINGS_BUCKET,
        Key: r.s3Key,
      });
      // URL expires in 1 hour
      const presignedUrl = await getS3SignedUrl(s3, command, { expiresIn: 3600 });
      return {
        id: r._id,
        songId: r.songId,
        songTitle: songMap[r.songId] || 'Unknown Song',
        score: r.score,
        timestamp: r.timestamp,
        url: presignedUrl
      };
    }));

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, recordings: enrichedRecordings }) };
  } catch (error) {
    console.error('Get user recordings error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};


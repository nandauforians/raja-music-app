const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backend/lambda_functions.js');
let code = fs.readFileSync(filePath, 'utf8');

const endpoints = `
// ============================================================================
// DUET FEATURE
// ============================================================================

exports.openDuet = async (event) => {
  try {
    const user = await verifyToken(event);
    const body = JSON.parse(event.body);
    const { songId, hostPart, hostVocalBase64 } = body;
    
    if (!songId || !hostPart || !hostVocalBase64) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
    const duetId = new Date().getTime().toString() + '_' + Math.random().toString(36).substr(2, 9);
    const s3Key = \`duets/host/\${songId}_\${duetId}.mp3\`;
    
    // Convert base64 to buffer and upload
    const base64Data = hostVocalBase64.replace(/^data:audio\\/\\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    await s3.putObject({
      Bucket: process.env.KARAOKE_BUCKET || 'uforian-karaoke-tracks',
      Key: s3Key,
      Body: buffer,
      ContentType: 'audio/mp3',
      ACL: 'public-read'
    }).promise();
    
    const hostVocalUrl = \`https://\${process.env.KARAOKE_BUCKET || 'uforian-karaoke-tracks'}.s3.\${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/\${s3Key}\`;

    const db = await getDb();
    
    // Fetch song info
    const song = await db.collection('songs').findOne({ id: String(songId) });
    const songTitle = song ? song.title : "Unknown Song";

    const duetDoc = {
      duetId,
      songId: String(songId),
      songTitle,
      hostUser: user.name || user.email,
      hostUserId: user.sub,
      hostPart,
      hostVocalUrl,
      status: 'open',
      guestUser: null,
      guestUserId: null,
      finalMixUrl: null,
      createdAt: new Date().toISOString()
    };

    await db.collection('duets').insertOne(duetDoc);

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, duet: duetDoc }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.getOpenDuets = async (event) => {
  try {
    const db = await getDb();
    const duets = await db.collection('duets').find({ status: 'open' }).sort({ createdAt: -1 }).limit(50).toArray();
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, duets }) };
  } catch (error) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.joinDuet = async (event) => {
  try {
    const user = await verifyToken(event);
    const body = JSON.parse(event.body);
    const { duetId, finalMixBase64 } = body;
    
    if (!duetId || !finalMixBase64) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
    const s3Key = \`duets/final/\${duetId}.mp3\`;
    
    const base64Data = finalMixBase64.replace(/^data:audio\\/\\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    await s3.putObject({
      Bucket: process.env.KARAOKE_BUCKET || 'uforian-karaoke-tracks',
      Key: s3Key,
      Body: buffer,
      ContentType: 'audio/mp3',
      ACL: 'public-read'
    }).promise();
    
    const finalMixUrl = \`https://\${process.env.KARAOKE_BUCKET || 'uforian-karaoke-tracks'}.s3.\${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/\${s3Key}\`;

    const db = await getDb();
    await db.collection('duets').updateOne(
      { duetId },
      { $set: { 
          status: 'completed', 
          guestUser: user.name || user.email, 
          guestUserId: user.sub,
          finalMixUrl,
          completedAt: new Date().toISOString()
        } 
      }
    );

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, finalMixUrl }) };
  } catch (error) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
`;

code = code + '\n' + endpoints;
fs.writeFileSync(filePath, code);
console.log('Endpoints added to lambda_functions.js');

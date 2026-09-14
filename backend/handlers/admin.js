const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const sqsClient = new SQSClient({ region: 'us-east-1' });

exports.getAdminGamification = async (event) => {
  try {
    await verifyAdminToken(event);
    
    const db = await getDb();
    const usersCol = db.collection('users');
    const activitiesCol = db.collection('activities');
    
    // Fetch all users with points
    const users = await usersCol.find({ totalPoints: { $gt: 0 } }).sort({ totalPoints: -1 }).toArray();
    
    const leaderboard = [];
    
    for (const u of users) {
      // Aggregate activity counts for this user
      const userActivities = await activitiesCol.find({ userId: u.userId }).toArray();
      
      let listens = 0, spotifyAdds = 0, karaokes = 0;
      userActivities.forEach(act => {
        if (act.action === 'listen_full') listens++;
        if (act.action === 'spotify_add') spotifyAdds++;
        if (act.action === 'karaoke_record') karaokes++;
      });
      
      leaderboard.push({
        userId: u.userId,
        name: u.name || 'Anonymous User', // Need user's name? If not stored, we use a fallback
        totalPoints: u.totalPoints,
        mobileNumber: u.mobileNumber || '',
        listens,
        spotifyAdds,
        karaokes
      });
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, leaderboard }) };
  } catch (error) {
    console.error("getAdminGamification error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.adminPayout = async (event) => {
  try {
    await verifyAdminToken(event);
    const body = JSON.parse(event.body || '{}');
    const { targetUserId, amount } = body;
    
    if (!targetUserId || !amount || amount <= 0) {
      throw new Error('Invalid payout parameters');
    }

    const db = await getDb();
    const users = db.collection('users');
    const payouts = db.collection('payouts');

    // Fetch user to verify points
    const user = await users.findOne({ userId: targetUserId });
    if (!user || (user.totalPoints || 0) < amount) {
      throw new Error('Insufficient points for payout');
    }

    // Deduct points
    await users.updateOne(
      { userId: targetUserId },
      { $inc: { totalPoints: -amount } }
    );

    // Log payout
    await payouts.insertOne({
      userId: targetUserId,
      amount,
      currency: 'INR',
      timestamp: new Date().toISOString()
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, newTotal: user.totalPoints - amount }) };
  } catch (error) {
    console.error("adminPayout error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.requestIncentive = async (event) => {
  try {
    const db = await getDb();
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'];
    if (!userId) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };

    const body = JSON.parse(event.body);
    const amount = Number(body.amount);
    const mobileNumber = body.mobileNumber;

    if (!amount || amount <= 0 || !mobileNumber) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Invalid amount or mobile number' }) };
    }

    const user = await db.collection('users').findOne({ userId });
    if (!user) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'User not found' }) };
    }

    const totalPoints = user.totalPoints || 0;
    const maxAllowed = Math.floor(totalPoints / 2);

    if (amount > maxAllowed) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: `You can only request up to 50% of your total points (${maxAllowed} pts)` }) };
    }

    // Deduct points
    await db.collection('users').updateOne(
      { userId },
      { $inc: { totalPoints: -amount } }
    );

    // Save request
    await db.collection('incentive_requests').insertOne({
      userId,
      userName: user.name || 'Unknown User',
      amount,
      mobileNumber,
      status: 'pending',
      requestedAt: new Date().toISOString()
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: 'Incentive requested successfully' }) };
  } catch (error) {
    console.error('Error in requestIncentive:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.getIncentiveRequests = async (event) => {
  try {
    const db = await getDb();
    const requests = await db.collection('incentive_requests').find({ status: 'pending' }).sort({ requestedAt: 1 }).toArray();
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, requests }) };
  } catch (error) {
    console.error('Error in getIncentiveRequests:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.approveIncentive = async (event) => {
  try {
    const db = await getDb();
    const body = JSON.parse(event.body);
    const requestId = body.requestId;
    if (!requestId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Missing requestId' }) };

    await db.collection('incentive_requests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'approved', approvedAt: new Date().toISOString() } }
    );

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('Error in approveIncentive:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.rejectIncentive = async (event) => {
  try {
    const db = await getDb();
    const body = JSON.parse(event.body);
    const requestId = body.requestId;
    if (!requestId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Missing requestId' }) };

    const reqData = await db.collection('incentive_requests').findOne({ _id: new ObjectId(requestId) });
    if (!reqData || reqData.status !== 'pending') {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, message: 'Invalid or already processed request' }) };
    }

    // Refund points
    await db.collection('users').updateOne(
      { userId: reqData.userId },
      { $inc: { totalPoints: reqData.amount } }
    );

    await db.collection('incentive_requests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'rejected', rejectedAt: new Date().toISOString() } }
    );

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('Error in rejectIncentive:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

exports.generateAdminTrivia = async (event) => {
  try {
    await verifyAdminToken(event);

    const body = JSON.parse(event.body);
    const prompt = body.prompt;

    if (!prompt) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Prompt is required' }) };
    }

    if (!process.env.GEMINI_API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Gemini API key missing' }) };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);
    const trivia = result.response.text();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, trivia })
    };
  } catch (error) {
    return { statusCode: error.message.startsWith('Unauthorized') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};


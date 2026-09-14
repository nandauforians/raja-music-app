const { getDb } = require('../utils/db');
const { verifyAdminToken } = require('../utils/auth');
const { signCloudFrontUrl } = require('../utils/cloudfront');
const { corsHeaders } = require('../utils/responses');
const { ObjectId } = require('mongodb');

exports.health = async (event) => {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, status: 'healthy' }) };
};


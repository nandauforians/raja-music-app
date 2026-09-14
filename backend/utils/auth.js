const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyAdminToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized: No token provided');
  
  try {
    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    if (payload.email !== 'nanda.uforians@gmail.com') {
      throw new Error(`Unauthorized: Email ${payload.email} is not Admin`);
    }
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error(`Unauthorized: ${error.message}`);
  }
}

module.exports = { verifyAdminToken };

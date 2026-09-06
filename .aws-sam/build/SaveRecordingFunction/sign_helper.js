const { getSignedUrl } = require('@aws-sdk/cloudfront-signer');

function signCloudFrontUrl(s3Url) {
  if (!s3Url) return s3Url;
  try {
    // If it's already a cloudfront URL, just return or sign it?
    // Let's assume it's stored as s3 amazonaws url
    const urlObj = new URL(s3Url);
    const key = urlObj.pathname.replace(/^\/+/, ''); // remove leading slash
    
    if (!process.env.DOMAIN_NAME || !process.env.CLOUDFRONT_KEY_PAIR_ID || !process.env.CLOUDFRONT_PRIVATE_KEY) {
      return s3Url; // fallback to what was in DB
    }
    
    const cfUrl = `https://${process.env.DOMAIN_NAME}/${key}`;
    return getSignedUrl({
      url: cfUrl,
      keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
      privateKey: process.env.CLOUDFRONT_PRIVATE_KEY,
      dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // 24 hours expiry
    });
  } catch(e) {
    console.error("Failed to sign CloudFront URL:", e);
    return s3Url; // fallback
  }
}

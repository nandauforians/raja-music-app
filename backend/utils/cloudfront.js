const { getSignedUrl } = require('@aws-sdk/cloudfront-signer');
const fs = require('fs');
const path = require('path');

let cachedPrivateKey = null;

function getCloudFrontPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;
  // Prefer env var (works in Lambda). Fall back to local .pem file (for local dev).
  if (process.env.CLOUDFRONT_PRIVATE_KEY && process.env.CLOUDFRONT_PRIVATE_KEY.includes('PRIVATE KEY')) {
    cachedPrivateKey = process.env.CLOUDFRONT_PRIVATE_KEY.replace(/\\n/g, '\n');
    return cachedPrivateKey;
  }
  try {
    cachedPrivateKey = fs.readFileSync(path.join(__dirname, '..', 'private_key.pem'), 'utf8');
    return cachedPrivateKey;
  } catch (e) {
    console.error("Failed to read private_key.pem and CLOUDFRONT_PRIVATE_KEY env var not set.", e);
    return null;
  }
}

const CLOUDFRONT_DOMAIN = 'ddttm9vr604n9.cloudfront.net';

function signCloudFrontUrl(anyUrl) {
  if (!anyUrl) return anyUrl;
  try {
    const urlObj = new URL(anyUrl);
    let key;

    if (urlObj.hostname.includes('amazonaws.com')) {
      // Raw S3 URL: extract the path as the key
      key = urlObj.pathname.replace(/^\/+/, '');
    } else if (urlObj.hostname.includes('cloudfront.net')) {
      // Already a CloudFront URL (possibly stale/expired): re-sign with a fresh expiry
      key = urlObj.pathname.replace(/^\/+/, '');
    } else {
      // Unknown URL type, return as-is
      return anyUrl;
    }

    const privateKey = getCloudFrontPrivateKey();

    if (!privateKey || !process.env.CLOUDFRONT_KEY_PAIR_ID) {
      console.log("Missing private key or key pair ID. Returning original URL.");
      return anyUrl;
    }

    const cfUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;
    return getSignedUrl({
      url: cfUrl,
      keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
      privateKey: privateKey,
      dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // 24 hours expiry
    });
  } catch(e) {
    console.error("Failed to sign CloudFront URL:", e);
    return anyUrl;
  }
}

module.exports = { getCloudFrontPrivateKey, signCloudFrontUrl };

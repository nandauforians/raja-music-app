const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: getS3SignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const RECORDINGS_BUCKET = process.env.RECORDINGS_BUCKET;

module.exports = { s3, getS3SignedUrl, PutObjectCommand, GetObjectCommand, RECORDINGS_BUCKET };

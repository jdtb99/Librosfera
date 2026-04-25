const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.AWS_S3_UPLOADS_BUCKET;

const buildKey = (prefix, filename) => `${prefix}/${filename}`.replace(/^\/+/, '');

const buildPublicUrl = (key) =>
  `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

async function uploadBuffer({ buffer, key, contentType }) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType
  }));
  return buildPublicUrl(key);
}

async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key
  }));
}

function extractKeyFromUrl(url) {
  if (!url) return null;
  const prefix = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  const match = url.match(/amazonaws\.com\/(.+)$/);
  return match ? match[1] : null;
}

module.exports = {
  s3,
  BUCKET,
  buildKey,
  buildPublicUrl,
  uploadBuffer,
  deleteObject,
  extractKeyFromUrl
};

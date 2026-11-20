const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Sin `credentials` explícitas: el SDK usa su cadena de resolución por
// defecto. En EC2 toma el IAM role de la instancia (instance profile
// `librosfera-backend-profile`, ver infra/iam.tf); en local usa el perfil
// de `aws configure` o AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY si los defines.
const s3 = new S3Client({
  region: process.env.AWS_REGION
});

const BUCKET = process.env.AWS_S3_UPLOADS_BUCKET;
// URL base de CloudFront (ej. https://d2yi4dc5p43lte.cloudfront.net) sin slash final
const CDN_URL = (process.env.CLOUDFRONT_URL || '').replace(/\/+$/, '');

const buildKey = (prefix, filename) => `${prefix}/${filename}`.replace(/^\/+/, '');

const buildPublicUrl = (key) =>
  CDN_URL
    ? `${CDN_URL}/${key}`
    : `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

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
  // URL de CloudFront: https://xxx.cloudfront.net/uploads/libros/file.jpg
  if (CDN_URL && url.startsWith(`${CDN_URL}/`)) {
    return url.slice(CDN_URL.length + 1);
  }
  // URL de S3 directa (registros legacy)
  const s3Prefix = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
  if (url.startsWith(s3Prefix)) return url.slice(s3Prefix.length);
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

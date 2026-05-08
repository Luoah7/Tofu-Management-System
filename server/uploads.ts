import './env.js';

import fs from 'fs';
import path from 'path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const dbPath = process.env.DB_PATH || './data/doufu.db';
const dbDir = path.dirname(dbPath);
const uploadRoot = process.env.UPLOAD_DIR || path.join(dbDir, 'uploads');
const taskUploadRoot = path.join(uploadRoot, 'tasks');

const r2AccountId = process.env.R2_ACCOUNT_ID || '';
const r2Bucket = process.env.R2_BUCKET || '';
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const r2Endpoint = process.env.R2_ENDPOINT || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : '');

const useR2 = Boolean(r2Bucket && r2AccessKeyId && r2SecretAccessKey && r2Endpoint);

const r2Client = useR2
  ? new S3Client({
      region: 'auto',
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    })
  : null;

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

if (!useR2) {
  ensureDir(taskUploadRoot);
}

export function getTaskUploadDir(taskId: string) {
  const taskDir = path.join(taskUploadRoot, taskId);
  ensureDir(taskDir);
  return taskDir;
}

export function getTaskPhotoPath(taskId: string, fileName: string) {
  return path.join(getTaskUploadDir(taskId), fileName);
}

export function getTaskPhotoKey(taskId: string, fileName: string) {
  return `tasks/${taskId}/${fileName}`;
}

export function getTaskPhotoUrl(taskId: string, fileName: string) {
  return `/uploads/tasks/${taskId}/${fileName}`;
}

export async function saveTaskPhoto(taskId: string, fileName: string, bytes: Buffer, mimeType: string) {
  if (useR2 && r2Client) {
    await r2Client.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: getTaskPhotoKey(taskId, fileName),
      Body: bytes,
      ContentType: mimeType,
    }));
    return;
  }

  fs.writeFileSync(getTaskPhotoPath(taskId, fileName), bytes);
}

export async function removeTaskPhoto(taskId: string, fileName: string) {
  if (useR2 && r2Client) {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: r2Bucket,
      Key: getTaskPhotoKey(taskId, fileName),
    }));
    return;
  }

  const photoPath = getTaskPhotoPath(taskId, fileName);
  if (fs.existsSync(photoPath)) {
    fs.unlinkSync(photoPath);
  }
}

export async function readTaskPhoto(taskId: string, fileName: string) {
  if (useR2 && r2Client) {
    const response = await r2Client.send(new GetObjectCommand({
      Bucket: r2Bucket,
      Key: getTaskPhotoKey(taskId, fileName),
    }));

    if (!response.Body) return null;

    const bytes = Buffer.from(await response.Body.transformToByteArray());
    return {
      body: bytes,
      contentType: response.ContentType || 'image/jpeg',
    };
  }

  const photoPath = getTaskPhotoPath(taskId, fileName);
  if (!fs.existsSync(photoPath)) {
    return null;
  }

  return {
    body: fs.readFileSync(photoPath),
    contentType: 'image/jpeg',
  };
}

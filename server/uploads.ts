import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH || './data/doufu.db';
const dbDir = path.dirname(dbPath);
const uploadRoot = process.env.UPLOAD_DIR || path.join(dbDir, 'uploads');
const taskUploadRoot = path.join(uploadRoot, 'tasks');

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(taskUploadRoot);

export function getTaskUploadDir(taskId: string) {
  const taskDir = path.join(taskUploadRoot, taskId);
  ensureDir(taskDir);
  return taskDir;
}

export function getTaskPhotoPath(taskId: string, fileName: string) {
  return path.join(getTaskUploadDir(taskId), fileName);
}

export function getTaskPhotoUrl(taskId: string, fileName: string) {
  return `/uploads/tasks/${taskId}/${fileName}`;
}

export function removeTaskPhoto(taskId: string, fileName: string) {
  const photoPath = getTaskPhotoPath(taskId, fileName);
  if (fs.existsSync(photoPath)) {
    fs.unlinkSync(photoPath);
  }
}

export function readTaskPhoto(taskId: string, fileName: string) {
  return fs.readFileSync(getTaskPhotoPath(taskId, fileName));
}

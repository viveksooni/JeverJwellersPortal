import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import { Request } from 'express';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(env.UPLOADS_DIR, 'products');
    ensureDir(dir);
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPG, PNG, and WebP images are allowed', 400));
  }
}

export const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 8 }, // 10MB per file, max 8 files
});

// Logo upload (single)
const logoStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(env.UPLOADS_DIR, 'logo');
    ensureDir(dir);
    cb(null, dir);
  },
  filename(_req, _file, cb) {
    cb(null, 'shop-logo.png');
  },
});

export const uploadLogo = multer({
  storage: logoStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

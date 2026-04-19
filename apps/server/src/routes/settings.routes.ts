import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import path from 'path';
import { db } from '../db/index.js';
import { shopSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { uploadLogo } from '../middleware/upload.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authenticate);

// Get all settings
router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const rows = await db.select().from(shopSettings);
    const data = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Update settings (batch)
const settingsSchema = z.object({
  shop_name: z.string().optional(),
  shop_address: z.string().optional(),
  shop_phone: z.string().optional(),
  shop_email: z.string().optional(),
  shop_gstin: z.string().optional(),
  gst_enabled: z.string().optional(),
  cgst_rate: z.string().optional(),
  sgst_rate: z.string().optional(),
  invoice_prefix: z.string().optional(),
  transaction_prefix: z.string().optional(),
});

router.patch('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = settingsSchema.parse(req.body);
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        await db
          .update(shopSettings)
          .set({ value, updatedAt: new Date() })
          .where(eq(shopSettings.key, key));
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Upload logo
router.post(
  '/logo',
  uploadLogo.single('logo'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      const logoUrl = `/uploads/logo/${path.basename(file.path)}`;

      await db
        .update(shopSettings)
        .set({ value: logoUrl, updatedAt: new Date() })
        .where(eq(shopSettings.key, 'logo_url'));

      res.json({ success: true, data: { logoUrl: `${env.PUBLIC_URL}${logoUrl}` } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Metal Types ──────────────────────────────────────────────────────────────
// Stored in shopSettings as JSON under key 'metal_types'

const DEFAULT_METAL_TYPES = [
  { name: 'gold',       prefix: 'G',  label: 'Gold' },
  { name: 'silver',     prefix: 'S',  label: 'Silver' },
  { name: 'platinum',   prefix: 'P',  label: 'Platinum' },
  { name: 'diamond',    prefix: 'D',  label: 'Diamond' },
  { name: 'rose gold',  prefix: 'RG', label: 'Rose Gold' },
  { name: 'white gold', prefix: 'WG', label: 'White Gold' },
  { name: 'other',      prefix: 'X',  label: 'Other' },
];

async function getMetalTypesFromDb() {
  const rows = await db.select().from(shopSettings).where(eq(shopSettings.key, 'metal_types'));
  if (rows.length && rows[0].value) {
    try { return JSON.parse(rows[0].value); } catch { /* fall through */ }
  }
  return DEFAULT_METAL_TYPES;
}

router.get('/metal-types', async (_req, res: Response, next: NextFunction) => {
  try {
    const data = await getMetalTypesFromDb();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

const metalTypeSchema = z.object({
  name:   z.string().min(1).max(50),
  prefix: z.string().min(1).max(10),
  label:  z.string().min(1).max(50),
});

router.post('/metal-types', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = metalTypeSchema.parse(req.body);
    const current = await getMetalTypesFromDb();
    if (current.find((m: any) => m.name.toLowerCase() === entry.name.toLowerCase())) {
      res.status(400).json({ success: false, error: 'Metal type already exists' });
      return;
    }
    const updated = [...current, entry];
    await db.insert(shopSettings)
      .values({ key: 'metal_types', value: JSON.stringify(updated) })
      .onConflictDoUpdate({ target: shopSettings.key, set: { value: JSON.stringify(updated), updatedAt: new Date() } });
    res.status(201).json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/metal-types/:name', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const name = req.params.name.toLowerCase();
    const current = await getMetalTypesFromDb();
    const updated = current.filter((m: any) => m.name.toLowerCase() !== name);
    await db.insert(shopSettings)
      .values({ key: 'metal_types', value: JSON.stringify(updated) })
      .onConflictDoUpdate({ target: shopSettings.key, set: { value: JSON.stringify(updated), updatedAt: new Date() } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

export default router;

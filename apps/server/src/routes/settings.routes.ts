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

export default router;

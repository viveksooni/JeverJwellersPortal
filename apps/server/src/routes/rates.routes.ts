import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { metalRates } from '../db/schema.js';
import { eq, lte, desc, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

// Inlined from @jever/shared — avoids a runtime ESM package resolution issue
// in the production Docker image. Keep in sync with packages/shared/src/constants/jewelry.ts
const METAL_RATE_KEYS = [
  'gold_24k', 'gold_22k', 'gold_18k', 'gold_14k',
  'silver_999', 'silver_925', 'platinum_950',
] as const;
type MetalRateKey = typeof METAL_RATE_KEYS[number];

const router = Router();
router.use(authenticate);

// Get today's effective rate for each metal type
router.get('/today', async (_req, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // For each metal type, get the most recent rate where effective_date <= today
    const results: Record<string, string | null> = {};
    for (const metal of METAL_RATE_KEYS) {
      const [rate] = await db
        .select()
        .from(metalRates)
        .where(and(eq(metalRates.metalType, metal), lte(metalRates.effectiveDate, today)))
        .orderBy(desc(metalRates.effectiveDate))
        .limit(1);
      results[metal] = rate?.ratePerGram ?? null;
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// Get rate history for a specific metal type
router.get('/history/:metalType', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await db
      .select()
      .from(metalRates)
      .where(eq(metalRates.metalType, req.params.metalType))
      .orderBy(desc(metalRates.effectiveDate))
      .limit(90); // Last 90 entries
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Get all future/upcoming rates
router.get('/upcoming', async (_req, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await db
      .select()
      .from(metalRates)
      .where(sql`${metalRates.effectiveDate} > ${today}`)
      .orderBy(metalRates.effectiveDate);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Create or update a rate (upsert by metalType + effectiveDate)
const rateSchema = z.object({
  metalType: z.enum(METAL_RATE_KEYS),
  ratePerGram: z.string(),
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().split('T')[0]),
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = rateSchema.parse(req.body);
    const [rate] = await db
      .insert(metalRates)
      .values(data)
      .onConflictDoUpdate({
        target: [metalRates.metalType, metalRates.effectiveDate],
        set: { ratePerGram: data.ratePerGram },
      })
      .returning();
    res.status(201).json({ success: true, data: rate });
  } catch (err) {
    next(err);
  }
});

// Delete a rate entry
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await db.delete(metalRates).where(eq(metalRates.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

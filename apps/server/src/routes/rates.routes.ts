import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { metalRates, shopSettings } from '../db/schema.js';
import { eq, lte, desc, and, sql as sqlExpr } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

// Default built-in rate keys (always shown even if no DB entry yet)
const DEFAULT_RATE_KEYS = [
  'gold_24k', 'gold_22k', 'gold_18k',
  'silver', 'silver_925',
];

/** Auto-generate a display label from a snake_case key like "gold_22k" → "Gold 22K" */
function keyToLabel(key: string): string {
  return key
    .split('_')
    .map((part) => {
      // Keep purity suffixes like 24k, 999, 925 uppercase; capitalise first char otherwise
      if (/^\d/.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

// ─── Custom rate-type storage ─────────────────────────────────────────────────
// Custom types are stored as JSON in shopSettings under the key 'custom_rate_types'.
// Shape: Array<{ key: string; label: string }>

const CUSTOM_RATE_TYPES_KEY = 'custom_rate_types';

async function getCustomRateTypes(): Promise<Array<{ key: string; label: string }>> {
  const rows = await db.select().from(shopSettings).where(eq(shopSettings.key, CUSTOM_RATE_TYPES_KEY));
  if (rows.length && rows[0].value) {
    try { return JSON.parse(rows[0].value); } catch { /* fall through */ }
  }
  return [];
}

async function saveCustomRateTypes(types: Array<{ key: string; label: string }>) {
  await db
    .insert(shopSettings)
    .values({ key: CUSTOM_RATE_TYPES_KEY, value: JSON.stringify(types) })
    .onConflictDoUpdate({
      target: shopSettings.key,
      set: { value: JSON.stringify(types), updatedAt: new Date() },
    });
}

/** Get all distinct metal types: defaults + custom stored types (merged with any orphan DB entries) */
async function getAllRateTypes(): Promise<Array<{ key: string; label: string; isDefault: boolean }>> {
  const customTypes = await getCustomRateTypes();
  const customKeys = new Set(customTypes.map((t) => t.key));
  const customLabelMap = new Map(customTypes.map((t) => [t.key, t.label]));

  // Also pull any keys in DB that are neither defaults nor custom (safety net)
  const rows = await db.execute(sql`SELECT DISTINCT metal_type FROM metal_rates ORDER BY metal_type`);
  const dbKeys = (rows.rows as any[]).map((r) => r.metal_type as string);

  const allKeys = new Set([...DEFAULT_RATE_KEYS, ...customTypes.map((t) => t.key), ...dbKeys]);

  return Array.from(allKeys)
    .sort()
    .map((key) => ({
      key,
      label: customLabelMap.get(key) ?? keyToLabel(key),
      isDefault: DEFAULT_RATE_KEYS.includes(key) && !customKeys.has(key),
    }));
}

const router = Router();
router.use(authenticate);

// ─── GET /types — list all rate types ────────────────────────────────────────
router.get('/types', async (_req, res: Response, next: NextFunction) => {
  try {
    const data = await getAllRateTypes();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /types — add a new custom rate type ─────────────────────────────────
const addTypeSchema = z.object({
  key:   z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Key must be lowercase letters, digits, and underscores only'),
  label: z.string().min(1).max(80).optional(),
});

router.post('/types', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { key, label } = addTypeSchema.parse(req.body);
    const resolvedLabel = label?.trim() || keyToLabel(key);

    if (DEFAULT_RATE_KEYS.includes(key)) {
      res.status(400).json({ success: false, error: 'This is a built-in rate type and cannot be re-added.' });
      return;
    }

    const current = await getCustomRateTypes();
    if (current.find((t) => t.key === key)) {
      res.status(400).json({ success: false, error: 'Rate type already exists.' });
      return;
    }

    const updated = [...current, { key, label: resolvedLabel }];
    await saveCustomRateTypes(updated);
    res.status(201).json({ success: true, data: { key, label: resolvedLabel } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /types/:key — remove a custom rate type + all its rate entries ────
router.delete('/types/:key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const key = req.params.key;

    if (DEFAULT_RATE_KEYS.includes(key)) {
      res.status(400).json({ success: false, error: 'Built-in rate types cannot be removed.' });
      return;
    }

    // Remove from custom list
    const current = await getCustomRateTypes();
    const updated = current.filter((t) => t.key !== key);
    await saveCustomRateTypes(updated);

    // Delete all rate entries for this type
    await db.delete(metalRates).where(eq(metalRates.metalType, key));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── GET /today — today's effective rate for each metal type ──────────────────
router.get('/today', async (_req, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const allTypes = await getAllRateTypes();

    const results: Record<string, string | null> = {};
    for (const { key } of allTypes) {
      const [rate] = await db
        .select()
        .from(metalRates)
        .where(and(eq(metalRates.metalType, key), lte(metalRates.effectiveDate, today)))
        .orderBy(desc(metalRates.effectiveDate))
        .limit(1);
      results[key] = rate?.ratePerGram ?? null;
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// ─── GET /history/:metalType — rate history for a specific metal type ─────────
router.get('/history/:metalType', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await db
      .select()
      .from(metalRates)
      .where(eq(metalRates.metalType, req.params.metalType))
      .orderBy(desc(metalRates.effectiveDate))
      .limit(90);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /upcoming — all future scheduled rates ───────────────────────────────
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

// ─── POST / — create or update a rate ────────────────────────────────────────
const rateSchema = z.object({
  metalType:     z.string().min(1).max(50),
  ratePerGram:   z.string(),
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

// ─── DELETE /:id — delete a single rate entry ─────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await db.delete(metalRates).where(eq(metalRates.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

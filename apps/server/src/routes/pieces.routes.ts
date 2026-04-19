import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { pieces, inventory, products } from '../db/schema.js';
import { eq, count, sql } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List pieces for a product
router.get('/', async (req, res: Response, next: NextFunction) => {
  try {
    const productId = req.query.productId as string;
    if (!productId) {
      res.status(400).json({ success: false, error: 'productId query param required' });
      return;
    }
    const data = await db.query.pieces.findMany({
      where: eq(pieces.productId, productId),
      orderBy: (p, { asc }) => [asc(p.createdAt)],
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

const pieceSchema = z.object({
  productId: z.string().uuid(),
  tagNo: z.string().max(50).optional(),
  grossWeightG: z.string().optional(),
  netWeightG: z.string().optional(),
  stoneWeightCt: z.string().optional(),
  purity: z.string().max(20).optional(),
  notes: z.string().optional(),
});

// Add piece
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = pieceSchema.parse(req.body);
    const [piece] = await db.insert(pieces).values({ ...body, status: 'in_stock' }).returning();

    // Sync inventory quantity + weight for this product
    await syncInventory(body.productId);

    res.status(201).json({ success: true, data: piece });
  } catch (err) { next(err); }
});

const updateSchema = z.object({
  tagNo: z.string().max(50).optional(),
  grossWeightG: z.string().optional(),
  netWeightG: z.string().optional(),
  stoneWeightCt: z.string().optional(),
  purity: z.string().max(20).optional(),
  status: z.enum(['in_stock', 'sold', 'on_repair', 'on_hold']).optional(),
  notes: z.string().optional(),
});

// Update piece
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = updateSchema.parse(req.body);
    const [piece] = await db
      .update(pieces)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(pieces.id, req.params.id))
      .returning();

    if (!piece) {
      res.status(404).json({ success: false, error: 'Piece not found' });
      return;
    }
    await syncInventory(piece.productId);
    res.json({ success: true, data: piece });
  } catch (err) { next(err); }
});

// Delete piece (only if in_stock)
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const piece = await db.query.pieces.findFirst({ where: eq(pieces.id, req.params.id) });
    if (!piece) {
      res.status(404).json({ success: false, error: 'Piece not found' });
      return;
    }
    if (piece.status !== 'in_stock') {
      res.status(400).json({ success: false, error: `Cannot delete a piece with status "${piece.status}"` });
      return;
    }
    await db.delete(pieces).where(eq(pieces.id, req.params.id));
    await syncInventory(piece.productId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Helper: recompute inventory quantity/weight from in_stock pieces ─────────

async function syncInventory(productId: string) {
  const inStockPieces = await db.query.pieces.findMany({
    where: (p, { and, eq }) => and(eq(p.productId, productId), eq(p.status, 'in_stock')),
  });

  const qty = inStockPieces.length;
  const totalWeight = inStockPieces.reduce(
    (sum, p) => sum + parseFloat(p.grossWeightG ?? '0'),
    0
  );

  await db
    .update(inventory)
    .set({ quantity: qty, totalWeightG: totalWeight.toFixed(4), lastUpdated: new Date() })
    .where(eq(inventory.productId, productId));
}

export { syncInventory };
export default router;

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { inventory, inventoryMovements, products } from '../db/schema.js';
import { eq, desc, sql, lt } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

// List all inventory
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await db.query.inventory.findMany({
      with: { product: { with: { category: true, images: true } } },
      orderBy: desc(inventory.lastUpdated),
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Low stock items
router.get('/low-stock', async (_req, res: Response, next: NextFunction) => {
  try {
    const data = await db
      .select()
      .from(inventory)
      .where(sql`${inventory.quantity} <= ${inventory.minStockAlert}`)
      .orderBy(inventory.quantity);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Get single product inventory
router.get('/:productId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const item = await db.query.inventory.findFirst({
      where: eq(inventory.productId, req.params.productId),
      with: { product: { with: { images: true } } },
    });
    if (!item) throw new AppError('Inventory not found', 404);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

const adjustSchema = z.object({
  quantity: z.number().int(),
  weightG: z.string().optional(),
  notes: z.string().optional(),
  location: z.string().optional(),
  minStockAlert: z.number().int().optional(),
});

// Manual stock adjustment
router.patch('/:productId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { quantity, weightG, notes, location, minStockAlert } = adjustSchema.parse(req.body);

    const [current] = await db
      .select()
      .from(inventory)
      .where(eq(inventory.productId, req.params.productId))
      .limit(1);

    if (!current) throw new AppError('Inventory not found', 404);

    const newQty = current.quantity + quantity;
    const updateData: Partial<typeof inventory.$inferInsert> = {
      quantity: newQty,
      lastUpdated: new Date(),
    };
    if (location !== undefined) updateData.location = location;
    if (minStockAlert !== undefined) updateData.minStockAlert = minStockAlert;
    if (weightG) {
      updateData.totalWeightG = String(
        parseFloat(current.totalWeightG ?? '0') + parseFloat(weightG),
      );
    }

    const [updated] = await db
      .update(inventory)
      .set(updateData)
      .where(eq(inventory.productId, req.params.productId))
      .returning();

    // Log movement
    await db.insert(inventoryMovements).values({
      productId: req.params.productId,
      movementType: 'adjustment',
      quantity,
      weightG,
      notes,
      createdBy: req.userId,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Movement log
router.get('/movements/log', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    const data = await db.query.inventoryMovements.findMany({
      orderBy: desc(inventoryMovements.createdAt),
      limit,
      offset,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;

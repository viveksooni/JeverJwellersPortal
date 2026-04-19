import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { categories, products } from '../db/schema.js';
import { eq, count } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List all categories
router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const data = await db.select().from(categories).orderBy(categories.name);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  skuPrefix: z.string().max(10).optional(),
  trackingType: z.enum(['template', 'per_piece']).optional(),
});

// Create category
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = categorySchema.parse(req.body);
    const [cat] = await db.insert(categories).values(body).returning();
    res.status(201).json({ success: true, data: cat });
  } catch (err) {
    next(err);
  }
});

// Update category
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const body = categorySchema.parse(req.body);
    const [cat] = await db.update(categories).set(body).where(eq(categories.id, id)).returning();
    if (!cat) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    res.json({ success: true, data: cat });
  } catch (err) {
    next(err);
  }
});

// Delete category (reject if products use it)
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const [{ total }] = await db
      .select({ total: count() })
      .from(products)
      .where(eq(products.categoryId, id));

    if (Number(total) > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete: ${total} product(s) are using this category. Reassign them first.`,
      });
      return;
    }

    await db.delete(categories).where(eq(categories.id, id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { customers, transactions } from '../db/schema.js';
import { eq, ilike, or, sql, desc, count } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

const customerSchema = z.object({
  name: z.string().min(1).max(150),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
});

// List customers
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const where = search
      ? or(ilike(customers.name, `%${search}%`), ilike(customers.phone, `%${search}%`))
      : undefined;

    const [data, [{ total }]] = await Promise.all([
      db.select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(customers).where(where),
    ]);

    res.json({
      success: true,
      data,
      total: Number(total),
      page,
      limit,
      totalPages: Math.ceil(Number(total) / limit),
    });
  } catch (err) {
    next(err);
  }
});

// Get single customer with stats
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [customer] = await db.select().from(customers).where(eq(customers.id, req.params.id)).limit(1);
    if (!customer) throw new AppError('Customer not found', 404);

    const [stats] = await db
      .select({
        totalTransactions: count(),
        totalSpent: sql<string>`COALESCE(SUM(final_amount), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.customerId, req.params.id));

    res.json({ success: true, data: { ...customer, ...stats } });
  } catch (err) {
    next(err);
  }
});

// Create customer
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = customerSchema.parse(req.body);
    const [customer] = await db.insert(customers).values(data).returning();
    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

// Update customer
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = customerSchema.partial().parse(req.body);
    const [customer] = await db
      .update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, req.params.id))
      .returning();
    if (!customer) throw new AppError('Customer not found', 404);
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

// Get customer's transactions
router.get('/:id/transactions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await db
      .select()
      .from(transactions)
      .where(eq(transactions.customerId, req.params.id))
      .orderBy(desc(transactions.transactionDate));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;

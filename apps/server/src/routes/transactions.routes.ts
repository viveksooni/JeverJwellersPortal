import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  transactions,
  transactionItems,
  repairOrders,
  inventory,
  inventoryMovements,
  pieces,
} from '../db/schema.js';
import { eq, and, gte, lte, desc, ilike, count, sql } from 'drizzle-orm';
import { syncInventory } from './pieces.routes.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateTransactionNo } from '../utils/invoiceNumber.js';

const router = Router();
router.use(authenticate);

// Convert empty string → null (prevents NUMERIC cast errors in PG)
const emptyToNull = (v: unknown) => (v === '' ? null : v);
const emptyToUndefined = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : v);

const itemSchema = z.object({
  productId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  pieceId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  productName: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  weightG: z.preprocess(emptyToNull, z.string().nullable().optional()),
  purity: z.preprocess(emptyToNull, z.string().nullable().optional()),
  ratePerGram: z.preprocess(emptyToNull, z.string().nullable().optional()),
  makingCharge: z.preprocess(emptyToNull, z.string().nullable().optional()),
  stoneCharge: z.preprocess((v) => (v === '' || v === null || v === undefined ? '0' : v), z.string()),
  unitPrice: z.string(),
  totalPrice: z.string(),
  isExchangeItem: z.boolean().default(false),
});

const transactionSchema = z.object({
  type: z.enum(['sale', 'purchase', 'repair', 'exchange', 'custom_order']),
  customerId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  totalAmount: z.string(),
  discountAmount: z.preprocess((v) => (v === '' || v === null || v === undefined ? '0' : v), z.string()),
  taxAmount: z.preprocess((v) => (v === '' || v === null || v === undefined ? '0' : v), z.string()),
  finalAmount: z.string(),
  paymentMethod: z.preprocess(emptyToUndefined, z.enum(['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'mixed']).optional()),
  paymentStatus: z.preprocess((v) => (v === '' || v === null || v === undefined ? 'unpaid' : v), z.enum(['unpaid', 'partial', 'paid'])),
  amountPaid: z.preprocess((v) => (v === '' || v === null || v === undefined ? '0' : v), z.string()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
  goldRate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  silverRate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  transactionDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  items: z.array(itemSchema).min(0),
  repairOrder: z
    .object({
      itemDescription: z.string().min(1),
      issueDescribed: z.preprocess(emptyToNull, z.string().nullable().optional()),
      repairType: z.preprocess(emptyToNull, z.string().nullable().optional()),
      estimatedDays: z.preprocess(emptyToUndefined, z.number().int().optional()),
      deliveryDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
      repairCharge: z.preprocess(emptyToNull, z.string().nullable().optional()),
      actualWeightG: z.preprocess(emptyToNull, z.string().nullable().optional()),
    })
    .optional(),
});

// List transactions
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, status, paymentStatus, customerId, from, to, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (type) conditions.push(eq(transactions.type, type as string));
    if (status) conditions.push(eq(transactions.status, status as string));
    if (paymentStatus) conditions.push(eq(transactions.paymentStatus, paymentStatus as string));
    if (customerId) conditions.push(eq(transactions.customerId, customerId as string));
    if (from) conditions.push(gte(transactions.transactionDate, new Date(from as string)));
    if (to) conditions.push(lte(transactions.transactionDate, new Date(to as string)));
    if (search) conditions.push(ilike(transactions.transactionNo, `%${search}%`));

    const where = conditions.length ? and(...conditions) : undefined;

    // Include items (with piece tag info) when fetching a single-day range (Day Book)
    const isSingleDay = from && to && from === to;

    const [data, [{ total }]] = await Promise.all([
      db.query.transactions.findMany({
        where,
        with: {
          customer: true,
          ...(isSingleDay ? { items: true } : {}),
        },
        orderBy: desc(transactions.transactionDate),
        limit,
        offset,
      }),
      db.select({ total: count() }).from(transactions).where(where),
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

// Get single transaction with items
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const txn = await db.query.transactions.findFirst({
      where: eq(transactions.id, req.params.id),
      with: { customer: true, items: true, repairOrder: true, invoice: true },
    });
    if (!txn) throw new AppError('Transaction not found', 404);
    res.json({ success: true, data: txn });
  } catch (err) {
    next(err);
  }
});

// Create transaction (handles inventory automatically)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = transactionSchema.parse(req.body);
    const transactionNo = await generateTransactionNo();

    const txnDate = data.transactionDate ? new Date(data.transactionDate) : new Date();

    const [txn] = await db
      .insert(transactions)
      .values({
        transactionNo,
        type: data.type,
        customerId: data.customerId,
        status: data.type === 'repair' ? 'in_progress' : 'completed',
        totalAmount: data.totalAmount,
        discountAmount: data.discountAmount,
        taxAmount: data.taxAmount,
        finalAmount: data.finalAmount,
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentStatus,
        amountPaid: data.amountPaid,
        notes: data.notes,
        goldRate: data.goldRate,
        silverRate: data.silverRate,
        transactionDate: txnDate,
        createdBy: req.userId,
      })
      .returning();

    // Insert items + update inventory
    for (const item of data.items) {
      await db.insert(transactionItems).values({ ...item, transactionId: txn.id });

      if (item.productId) {
        // If a specific piece was sold, mark it sold and sync inventory from pieces
        if (item.pieceId && data.type === 'sale') {
          await db
            .update(pieces)
            .set({ status: 'sold', soldTransactionId: txn.id, updatedAt: new Date() })
            .where(eq(pieces.id, item.pieceId));
          await syncInventory(item.productId);
        } else {
          // Template tracking — update inventory quantity directly
          const qty = data.type === 'sale' ? -item.quantity : data.type === 'purchase' ? item.quantity : 0;
          if (qty !== 0) {
            await db
              .update(inventory)
              .set({
                quantity: sql`${inventory.quantity} + ${qty}`,
                lastUpdated: new Date(),
              })
              .where(eq(inventory.productId, item.productId));
          }
        }

        // Always log movement
        const qty = data.type === 'sale' ? -item.quantity : data.type === 'purchase' ? item.quantity : 0;
        if (qty !== 0) {
          await db.insert(inventoryMovements).values({
            productId: item.productId,
            movementType: data.type === 'sale' ? 'out' : 'in',
            quantity: qty,
            weightG: item.weightG,
            referenceId: txn.id,
            notes: `Auto from ${data.type} ${transactionNo}${item.pieceId ? ` (piece)` : ''}`,
            createdBy: req.userId,
          });
        }
      }
    }

    // Insert repair order if applicable
    if (data.type === 'repair' && data.repairOrder) {
      await db.insert(repairOrders).values({
        transactionId: txn.id,
        ...data.repairOrder,
      });
    }

    const full = await db.query.transactions.findFirst({
      where: eq(transactions.id, txn.id),
      with: { customer: true, items: true, repairOrder: true },
    });

    res.status(201).json({ success: true, data: full });
  } catch (err) {
    next(err);
  }
});

// Update transaction (status/payment changes)
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      status: z.preprocess(emptyToUndefined, z.enum(['pending', 'completed', 'cancelled', 'in_progress']).optional()),
      paymentStatus: z.preprocess(emptyToUndefined, z.enum(['unpaid', 'partial', 'paid']).optional()),
      amountPaid: z.preprocess(emptyToNull, z.string().nullable().optional()),
      paymentMethod: z.preprocess(emptyToNull, z.string().nullable().optional()),
      notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
    });
    const parsed = schema.parse(req.body);
    // Strip undefined keys so we only touch fields that were sent
    const data = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== undefined)
    );
    const [txn] = await db
      .update(transactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transactions.id, req.params.id))
      .returning();
    if (!txn) throw new AppError('Transaction not found', 404);
    res.json({ success: true, data: txn });
  } catch (err) {
    next(err);
  }
});

// Update repair order status
router.patch('/:id/repair', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      status: z.preprocess(emptyToUndefined, z.enum(['received', 'in_progress', 'ready', 'delivered']).optional()),
      technicianNotes: z.preprocess(emptyToNull, z.string().nullable().optional()),
      deliveryDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
      repairCharge: z.preprocess(emptyToNull, z.string().nullable().optional()),
    });
    const parsed = schema.parse(req.body);
    const data = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== undefined)
    );
    const [order] = await db
      .update(repairOrders)
      .set(data)
      .where(eq(repairOrders.transactionId, req.params.id))
      .returning();
    if (!order) throw new AppError('Repair order not found', 404);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

export default router;

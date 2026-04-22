import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { db } from '../db/index.js';
import { products, productImages, inventory, categories } from '../db/schema.js';
import { eq, ilike, and, desc, count, or } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { uploadProductImages } from '../middleware/upload.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authenticate);

// Convert empty string → null for any field (prevents NUMERIC cast errors in PG)
const emptyToNull = (v: unknown) => (v === '' ? null : v);
const emptyToUndefined = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : v);

const productSchema = z.object({
  categoryId: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
  name: z.string().min(1).max(200),
  sku:           z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  description:   z.preprocess(emptyToNull, z.string().nullable().optional()),
  metalType:     z.preprocess(emptyToNull, z.string().nullable().optional()),
  purity:        z.preprocess(emptyToNull, z.string().nullable().optional()),
  grossWeightG:  z.preprocess(emptyToNull, z.string().nullable().optional()),
  netWeightG:    z.preprocess(emptyToNull, z.string().nullable().optional()),
  stoneType:     z.preprocess(emptyToNull, z.string().nullable().optional()),
  stoneWeightCt: z.preprocess(emptyToNull, z.string().nullable().optional()),
  makingCharge:  z.preprocess(emptyToNull, z.string().nullable().optional()),
  makingType: z.preprocess(
    emptyToUndefined,
    z.enum(['flat', 'per_gram', 'percentage']).default('flat')
  ),
  trackingType: z.preprocess(
    emptyToUndefined,
    z.enum(['template', 'per_piece']).default('template')
  ),
  attributes: z.record(z.unknown()).default({}),
  // Inventory-side fields (stored on inventory row, not products)
  location:      z.preprocess(emptyToNull, z.string().nullable().optional()),
  quantity:      z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  minStockAlert: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
});

// Looser schema for PUT — handles empty strings, nulls, missing attributes
const productUpdateSchema = z.object({
  categoryId: z.preprocess(
    emptyToUndefined,
    z.coerce.number().optional()
  ),
  name: z.string().min(1).max(200).optional(),
  sku:           z.preprocess(emptyToNull, z.string().max(100).nullable().optional()),
  description:   z.preprocess(emptyToNull, z.string().nullable().optional()),
  metalType:     z.preprocess(emptyToNull, z.string().nullable().optional()),
  purity:        z.preprocess(emptyToNull, z.string().nullable().optional()),
  grossWeightG:  z.preprocess(emptyToNull, z.string().nullable().optional()),
  netWeightG:    z.preprocess(emptyToNull, z.string().nullable().optional()),
  stoneType:     z.preprocess(emptyToNull, z.string().nullable().optional()),
  stoneWeightCt: z.preprocess(emptyToNull, z.string().nullable().optional()),
  makingCharge:  z.preprocess(emptyToNull, z.string().nullable().optional()),
  makingType: z.preprocess(
    emptyToUndefined,
    z.enum(['flat', 'per_gram', 'percentage']).optional()
  ),
  trackingType: z.preprocess(
    emptyToUndefined,
    z.enum(['template', 'per_piece']).optional()
  ),
  attributes: z.record(z.unknown()).optional(),
  // Inventory-side fields (applied to the linked inventory row)
  location:      z.preprocess(emptyToNull, z.string().nullable().optional()),
  quantity:      z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  minStockAlert: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
});

// List products
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, categoryId, metalType, isActive, page: p, limit: l } = req.query;
    const page = Math.max(1, parseInt(p as string) || 1);
    const limit = Math.min(100, parseInt(l as string) || 20);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (isActive !== undefined) conditions.push(eq(products.isActive, isActive === 'true'));
    else conditions.push(eq(products.isActive, true));
    if (categoryId) conditions.push(eq(products.categoryId, Number(categoryId)));
    if (metalType) conditions.push(eq(products.metalType, metalType as string));
    if (search) conditions.push(or(ilike(products.name, `%${search}%`), ilike(products.sku, `%${search}%`)));

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db.query.products.findMany({
        where,
        with: { category: true, images: true, inventory: true },
        orderBy: desc(products.createdAt),
        limit,
        offset,
      }),
      db.select({ total: count() }).from(products).where(where),
    ]);

    res.json({
      success: true,
      data: rows,
      total: Number(total),
      page,
      limit,
      totalPages: Math.ceil(Number(total) / limit),
    });
  } catch (err) {
    next(err);
  }
});

// Get single product
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, req.params.id),
      with: { category: true, images: true, inventory: true },
    });
    if (!product) throw new AppError('Product not found', 404);
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// Create product
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = productSchema.parse(req.body);
    // Separate inventory-side fields from product fields
    const { location, quantity, minStockAlert, ...productData } = parsed;
    const [product] = await db.insert(products).values(productData).returning();

    // Auto-create inventory row with optional location / quantity / minStockAlert
    const invRow: Record<string, unknown> = { productId: product.id };
    if (location !== undefined) invRow.location = location;
    if (quantity !== undefined) invRow.quantity = quantity;
    if (minStockAlert !== undefined) invRow.minStockAlert = minStockAlert;
    await db.insert(inventory).values(invRow as any).onConflictDoNothing();

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// Update product
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = productUpdateSchema.parse(req.body);
    // Separate inventory-side fields from product fields
    const { location, quantity, minStockAlert, ...productFields } = parsed;

    // Strip undefined so we only update fields that were actually sent
    const prodData = Object.fromEntries(
      Object.entries(productFields).filter(([, v]) => v !== undefined)
    );
    const [product] = await db
      .update(products)
      .set({ ...prodData, updatedAt: new Date() })
      .where(eq(products.id, req.params.id))
      .returning();
    if (!product) throw new AppError('Product not found', 404);

    // Apply inventory updates (only fields that were sent)
    const invPatch: Record<string, unknown> = {};
    if (location !== undefined) invPatch.location = location;
    if (quantity !== undefined) invPatch.quantity = quantity;
    if (minStockAlert !== undefined) invPatch.minStockAlert = minStockAlert;
    if (Object.keys(invPatch).length > 0) {
      invPatch.lastUpdated = new Date();
      await db
        .insert(inventory)
        .values({ productId: product.id, ...invPatch } as any)
        .onConflictDoUpdate({
          target: inventory.productId,
          set: invPatch as any,
        });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// Soft delete product
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [product] = await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(products.id, req.params.id))
      .returning();
    if (!product) throw new AppError('Product not found', 404);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Upload product images
router.post(
  '/:id/images',
  uploadProductImages.array('images', 8),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files?.length) throw new AppError('No images uploaded', 400);

      const [product] = await db.select().from(products).where(eq(products.id, req.params.id)).limit(1);
      if (!product) throw new AppError('Product not found', 404);

      const existing = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, req.params.id));

      const imageRows = [];
      for (const [i, file] of files.entries()) {
        // Resize with sharp
        const thumbPath = file.path.replace(/(\.\w+)$/, '-thumb$1');
        await sharp(file.path).resize(400, 400, { fit: 'inside' }).toFile(thumbPath);

        const url = `${env.PUBLIC_URL}/uploads/products/${path.basename(file.path)}`;
        const isPrimary = existing.length === 0 && i === 0;
        const [img] = await db
          .insert(productImages)
          .values({ productId: req.params.id, url, isPrimary, sortOrder: existing.length + i })
          .returning();
        imageRows.push(img);
      }

      res.status(201).json({ success: true, data: imageRows });
    } catch (err) {
      next(err);
    }
  },
);

// Delete product image
router.delete('/:id/images/:imageId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [img] = await db
      .delete(productImages)
      .where(and(eq(productImages.id, req.params.imageId), eq(productImages.productId, req.params.id)))
      .returning();
    if (!img) throw new AppError('Image not found', 404);

    // Delete file from disk
    const filename = path.basename(new URL(img.url).pathname);
    const filePath = path.join(env.UPLOADS_DIR, 'products', filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Get categories
router.get('/meta/categories', async (_req, res: Response, next: NextFunction) => {
  try {
    const data = await db.select().from(categories).orderBy(categories.name);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Get next available SKU for a given prefix (e.g. GR → GR-003)
router.get('/meta/next-sku', async (req, res: Response, next: NextFunction) => {
  try {
    const prefix = String(req.query.prefix ?? '').toUpperCase();
    if (!prefix) {
      res.status(400).json({ success: false, error: 'prefix query param required' });
      return;
    }
    // Find all existing SKUs that start with this prefix pattern
    const existing = await db
      .select({ sku: products.sku })
      .from(products)
      .where(ilike(products.sku, `${prefix}-%`));

    let maxNum = 0;
    for (const { sku } of existing) {
      if (!sku) continue;
      const parts = sku.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    const next = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
    res.json({ success: true, data: { sku: next } });
  } catch (err) {
    next(err);
  }
});

export default router;

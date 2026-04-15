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

const productSchema = z.object({
  categoryId: z.coerce.number().optional(),
  name: z.string().min(1).max(200),
  sku: z.string().max(100).optional(),
  description: z.string().optional(),
  metalType: z.string().optional(),
  purity: z.string().optional(),
  grossWeightG: z.string().optional(),
  netWeightG: z.string().optional(),
  stoneType: z.string().optional(),
  stoneWeightCt: z.string().optional(),
  makingCharge: z.string().optional(),
  makingType: z.enum(['flat', 'per_gram', 'percentage']).default('flat'),
  attributes: z.record(z.unknown()).default({}),
});

// Looser schema for PUT — handles empty strings, nulls, missing attributes
const productUpdateSchema = z.object({
  categoryId: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : Number(v),
    z.number().optional()
  ),
  name: z.string().min(1).max(200).optional(),
  sku: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(100).nullable().optional()
  ),
  description: z.string().nullable().optional(),
  metalType: z.string().nullable().optional(),
  purity: z.string().nullable().optional(),
  grossWeightG: z.string().nullable().optional(),
  netWeightG: z.string().nullable().optional(),
  stoneType: z.string().nullable().optional(),
  stoneWeightCt: z.string().nullable().optional(),
  makingCharge: z.string().nullable().optional(),
  makingType: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.enum(['flat', 'per_gram', 'percentage']).optional()
  ),
  attributes: z.record(z.unknown()).optional(),
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
    const data = productSchema.parse(req.body);
    const [product] = await db.insert(products).values(data).returning();

    // Auto-create inventory row
    await db.insert(inventory).values({ productId: product.id }).onConflictDoNothing();

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// Update product
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = productUpdateSchema.parse(req.body);
    // Strip undefined so we only update fields that were actually sent
    const data = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== undefined)
    );
    const [product] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, req.params.id))
      .returning();
    if (!product) throw new AppError('Product not found', 404);
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

export default router;

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { db } from '../db/index.js';
import { invoices, transactions, customers, shopSettings, transactionItems } from '../db/schema.js';
import { eq, desc, ilike, count, and, gte, lte } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateInvoiceNo } from '../utils/invoiceNumber.js';
import { generateInvoicePdf } from '../services/pdf.service.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authenticate);

// List invoices
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const { from, to, gstEnabled } = req.query;

    const conditions: any[] = [];
    if (from) conditions.push(gte(invoices.issuedAt, new Date(from as string)));
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(invoices.issuedAt, toDate));
    }
    if (gstEnabled !== undefined) conditions.push(eq(invoices.gstEnabled, gstEnabled === 'true'));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, [{ total }]] = await Promise.all([
      db.query.invoices.findMany({
        where,
        with: { customer: true },
        orderBy: desc(invoices.issuedAt),
        limit,
        offset,
      }),
      db.select({ total: count() }).from(invoices).where(where),
    ]);

    res.json({ success: true, data, total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) });
  } catch (err) {
    next(err);
  }
});

// Get single invoice
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, req.params.id),
      with: { transaction: { with: { items: true, customer: true, repairOrder: true } }, customer: true },
    });
    if (!invoice) throw new AppError('Invoice not found', 404);
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

// Create invoice from transaction
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      transactionId: z.string().uuid(),
      gstEnabled: z.boolean().default(false),
      gstin: z.string().optional(),
      cgstRate: z.string().optional(),
      sgstRate: z.string().optional(),
    });
    const data = schema.parse(req.body);

    // Check not already invoiced
    const existing = await db.query.invoices.findFirst({
      where: eq(invoices.transactionId, data.transactionId),
    });
    if (existing) {
      res.json({ success: true, data: existing, message: 'Invoice already exists' });
      return;
    }

    const txn = await db.query.transactions.findFirst({
      where: eq(transactions.id, data.transactionId),
      with: { customer: true, items: true },
    });
    if (!txn) throw new AppError('Transaction not found', 404);

    // Fetch shop settings
    const settings = await db.select().from(shopSettings);
    const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));

    const invoiceNo = await generateInvoiceNo();

    // Generate PDF
    const pdfUrl = await generateInvoicePdf({
      invoiceNo,
      invoiceDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      shopName: s.shop_name ?? 'Jever Jwellers',
      shopAddress: s.shop_address ?? '',
      shopPhone: s.shop_phone ?? '',
      shopEmail: s.shop_email ?? '',
      shopGstin: data.gstEnabled ? (data.gstin ?? s.shop_gstin ?? '') : '',
      logoUrl: s.logo_url ? `${process.env.PUBLIC_URL}${s.logo_url}` : null,
      customer: txn.customer
        ? { name: txn.customer.name, phone: txn.customer.phone, email: txn.customer.email, address: txn.customer.address }
        : null,
      transactionNo: txn.transactionNo,
      transactionDate: new Date(txn.transactionDate).toLocaleDateString('en-IN'),
      paymentMethod: txn.paymentMethod,
      items: txn.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        purity: item.purity,
        weightG: item.weightG,
        ratePerGram: item.ratePerGram,
        makingCharge: item.makingCharge,
        stoneCharge: item.stoneCharge,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        isExchangeItem: item.isExchangeItem,
        metalType: item.metalType,
      })),
      totalAmount: txn.totalAmount,
      discountAmount: txn.discountAmount,
      gstEnabled: data.gstEnabled,
      cgstRate: data.cgstRate ?? s.cgst_rate ?? '1.5',
      sgstRate: data.sgstRate ?? s.sgst_rate ?? '1.5',
      taxAmount: txn.taxAmount,
      finalAmount: txn.finalAmount,
      amountPaid: txn.amountPaid,
      paymentDate: new Date(txn.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }),
      notes: txn.notes,
      shopBankAccount: s.shop_bank_account ?? '',
      shopBankName: s.shop_bank_name ?? '',
      shopBankBranch: s.shop_bank_branch ?? '',
      shopBankIfsc: s.shop_bank_ifsc ?? '',
      shopTerms: s.shop_terms ?? '',
    });

    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNo,
        transactionId: data.transactionId,
        customerId: txn.customerId,
        pdfUrl,
        gstEnabled: data.gstEnabled,
        gstin: data.gstin,
        cgstRate: data.cgstRate ?? s.cgst_rate ?? '1.5',
        sgstRate: data.sgstRate ?? s.sgst_rate ?? '1.5',
        createdBy: req.userId,
      })
      .returning();

    res.status(201).json({ success: true, data: { ...invoice, pdfUrl } });
  } catch (err) {
    next(err);
  }
});

// Force-download PDF (works cross-origin, sets Content-Disposition: attachment)
router.get('/:id/download', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, req.params.id),
    });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (!invoice.pdfUrl) throw new AppError('PDF not yet generated', 404);

    // Resolve local file path from the stored URL
    const filename = path.basename(invoice.pdfUrl);
    const filePath = path.join(env.UPLOADS_DIR, 'invoices', filename);

    if (!fs.existsSync(filePath)) throw new AppError('PDF file not found on server', 404);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    next(err);
  }
});

// Get WhatsApp link for invoice
router.post('/:id/whatsapp', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, req.params.id),
      with: { customer: true },
    });
    if (!invoice) throw new AppError('Invoice not found', 404);

    const phone = invoice.customer?.phone?.replace(/\D/g, '');
    if (!phone) throw new AppError('Customer has no phone number', 400);

    const message = encodeURIComponent(
      `Hello ${invoice.customer?.name ?? 'Customer'},\n\nThank you for visiting Jever Jwellers!\n\nYour invoice *${invoice.invoiceNo}* is ready.\n\nDownload here: ${invoice.pdfUrl}\n\nFor any queries, feel free to contact us.`,
    );

    const waUrl = `https://wa.me/${phone}?text=${message}`;

    // Mark as sent
    await db
      .update(invoices)
      .set({ whatsappSent: true, whatsappSentAt: new Date() })
      .where(eq(invoices.id, req.params.id));

    res.json({ success: true, data: { waUrl } });
  } catch (err) {
    next(err);
  }
});

export default router;

import { db } from '../db/index.js';
import { invoices, transactions, shopSettings } from '../db/schema.js';
import { eq, like, desc } from 'drizzle-orm';

async function getPrefix(key: string, fallback: string): Promise<string> {
  const [setting] = await db
    .select()
    .from(shopSettings)
    .where(eq(shopSettings.key, key))
    .limit(1);
  return setting?.value || fallback;
}

export async function generateInvoiceNo(): Promise<string> {
  const prefix = await getPrefix('invoice_prefix', 'INV');
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  const [last] = await db
    .select({ invoiceNo: invoices.invoiceNo })
    .from(invoices)
    .where(like(invoices.invoiceNo, pattern))
    .orderBy(desc(invoices.invoiceNo))
    .limit(1);

  let seq = 1;
  if (last) {
    const parts = last.invoiceNo.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
}

export async function generateTransactionNo(): Promise<string> {
  const prefix = await getPrefix('transaction_prefix', 'TXN');
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  const [last] = await db
    .select({ transactionNo: transactions.transactionNo })
    .from(transactions)
    .where(like(transactions.transactionNo, pattern))
    .orderBy(desc(transactions.transactionNo))
    .limit(1);

  let seq = 1;
  if (last) {
    const parts = last.transactionNo.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
}

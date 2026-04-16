import type { Transaction } from './transaction.js';
import type { Customer } from './customer.js';

export interface Invoice {
  id: string;
  invoiceNo: string;
  transactionId: string;
  customerId: string | null;
  customer?: Customer;
  transaction?: Transaction;
  pdfUrl: string | null;
  whatsappSent: boolean;
  whatsappSentAt: string | null;
  issuedAt: string;
  gstEnabled: boolean;
  gstin: string | null;
  cgstRate: string | null;
  sgstRate: string | null;
}

export interface CreateInvoiceDto {
  transactionId: string;
  gstEnabled?: boolean;
  gstin?: string;
  cgstRate?: string;
  sgstRate?: string;
}

export interface InvoiceFilters {
  search?: string;
  from?: string;
  to?: string;
  whatsappSent?: boolean;
  page?: number;
  limit?: number;
}

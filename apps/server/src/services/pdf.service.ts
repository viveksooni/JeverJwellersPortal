import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

interface InvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  shopGstin: string;
  logoUrl: string | null;
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  transactionNo: string;
  transactionDate: string;
  paymentMethod: string | null;
  items: {
    productName: string;
    quantity: number;
    purity: string | null;
    weightG: string | null;
    ratePerGram: string | null;
    makingCharge: string | null;
    stoneCharge: string;
    unitPrice: string;
    totalPrice: string;
    isExchangeItem: boolean;
  }[];
  totalAmount: string;
  discountAmount: string;
  gstEnabled: boolean;
  cgstRate: string | null;
  sgstRate: string | null;
  taxAmount: string;
  finalAmount: string;
  amountPaid: string;
  notes: string | null;
}

function buildHtml(data: InvoiceData): string {
  const formatCurrency = (v: string | null) =>
    v ? `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

  const itemRows = data.items
    .map(
      (item, i) => `
    <tr class="${item.isExchangeItem ? 'exchange-row' : ''}">
      <td>${i + 1}</td>
      <td>${item.productName}${item.isExchangeItem ? ' <span class="badge">Exchange</span>' : ''}
        ${item.purity ? `<br/><small>${item.purity}</small>` : ''}
      </td>
      <td>${item.quantity}</td>
      <td>${item.weightG ? item.weightG + 'g' : '-'}</td>
      <td>${item.ratePerGram ? formatCurrency(item.ratePerGram) + '/g' : '-'}</td>
      <td>${item.makingCharge ? formatCurrency(item.makingCharge) : '-'}</td>
      <td>${formatCurrency(item.stoneCharge)}</td>
      <td>${formatCurrency(item.totalPrice)}</td>
    </tr>`,
    )
    .join('');

  const gstSection = data.gstEnabled
    ? `
    <tr>
      <td colspan="6"></td>
      <td>CGST (${data.cgstRate}%)</td>
      <td>${formatCurrency(String(parseFloat(data.taxAmount) / 2))}</td>
    </tr>
    <tr>
      <td colspan="6"></td>
      <td>SGST (${data.sgstRate}%)</td>
      <td>${formatCurrency(String(parseFloat(data.taxAmount) / 2))}</td>
    </tr>`
    : '';

  const logoHtml = data.logoUrl
    ? `<img src="${data.logoUrl}" alt="Logo" style="height:70px;object-fit:contain;" />`
    : `<div style="height:70px;display:flex;align-items:center;">
        <div style="width:60px;height:60px;background:#C9972A;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-family:'Cormorant Garamond',serif;font-weight:700;">J</div>
       </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; font-size: 12px; color: #1a1109; background: #fff; padding: 32px; }
  h1, h2, .shop-name { font-family: 'Cormorant Garamond', serif; }
  .shop-name { font-size: 28px; font-weight: 700; color: #C9972A; letter-spacing: 1px; }
  .invoice-title { font-size: 20px; font-weight: 600; color: #8B6914; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #C9972A; padding-bottom: 16px; }
  .shop-info { line-height: 1.6; color: #555; font-size: 11px; word-break: break-word; overflow-wrap: break-word; max-width: 300px; }
  .invoice-meta { text-align: right; }
  .invoice-meta .label { color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .invoice-meta .value { font-weight: 600; font-size: 13px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
  .party-box { background: #faf7f0; border: 1px solid #e8dcc0; border-radius: 6px; padding: 12px 16px; word-break: break-word; overflow-wrap: break-word; }
  .party-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #C9972A; font-weight: 600; margin-bottom: 4px; }
  .party-box .name { font-size: 14px; font-weight: 600; font-family: 'Cormorant Garamond', serif; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  thead tr { background: #C9972A; color: #fff; }
  thead th { padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.3px; }
  tbody tr { border-bottom: 1px solid #f0e8d4; }
  tbody tr:nth-child(even) { background: #fdfaf4; }
  tbody td { padding: 8px 10px; }
  .exchange-row { background: #fff8e8 !important; }
  .badge { display: inline-block; background: #C9972A; color: #fff; font-size: 9px; padding: 1px 5px; border-radius: 3px; vertical-align: middle; }
  .totals-table { margin-left: auto; width: 320px; }
  .totals-table td { padding: 5px 10px; }
  .totals-table .total-row { font-size: 14px; font-weight: 700; border-top: 2px solid #C9972A; }
  .totals-table .total-row td { padding-top: 8px; color: #8B6914; font-family: 'Cormorant Garamond', serif; }
  .footer { margin-top: 32px; border-top: 1px solid #e8dcc0; padding-top: 16px; display: flex; justify-content: space-between; }
  .footer .note { font-size: 11px; color: #888; max-width: 60%; line-height: 1.5; }
  .signature { text-align: center; }
  .signature-line { border-top: 1px solid #aaa; width: 120px; margin: 24px auto 4px; }
  .signature small { font-size: 10px; color: #888; }
  .gstin-line { font-size: 11px; color: #555; margin-top: 2px; }
  small { font-size: 10px; color: #888; }
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:center;gap:16px;">
    ${logoHtml}
    <div>
      <div class="shop-name">${data.shopName}</div>
      <div class="shop-info">
        ${data.shopAddress ? data.shopAddress + '<br/>' : ''}
        ${data.shopPhone ? data.shopPhone : ''}${data.shopEmail ? ' | ' + data.shopEmail : ''}
        ${data.shopGstin ? `<br/><span class="gstin-line">GSTIN: ${data.shopGstin}</span>` : ''}
      </div>
    </div>
  </div>
  <div class="invoice-meta">
    <div class="invoice-title">TAX INVOICE</div>
    <div style="margin-top:8px;">
      <div class="label">Invoice No</div>
      <div class="value">${data.invoiceNo}</div>
    </div>
    <div style="margin-top:4px;">
      <div class="label">Date</div>
      <div class="value">${data.invoiceDate}</div>
    </div>
    <div style="margin-top:4px;">
      <div class="label">Ref</div>
      <div class="value">${data.transactionNo}</div>
    </div>
  </div>
</div>

<div class="parties">
  <div class="party-box">
    <div class="label">Billed To</div>
    ${data.customer
      ? `<div class="name">${data.customer.name}</div>
         ${data.customer.phone ? `<div>${data.customer.phone}</div>` : ''}
         ${data.customer.email ? `<div>${data.customer.email}</div>` : ''}
         ${data.customer.address ? `<div style="margin-top:4px;font-size:11px;color:#666;">${data.customer.address}</div>` : ''}`
      : '<div class="name">Walk-in Customer</div>'}
  </div>
  <div class="party-box">
    <div class="label">Payment</div>
    <div class="name">${data.paymentMethod ?? 'Not specified'}</div>
    <div style="margin-top:4px;">Amount Paid: <strong>${formatCurrency(data.amountPaid)}</strong></div>
    <div>Balance: <strong>${formatCurrency(String(parseFloat(data.finalAmount) - parseFloat(data.amountPaid)))}</strong></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Item</th>
      <th>Qty</th>
      <th>Weight</th>
      <th>Rate/g</th>
      <th>Making</th>
      <th>Stone</th>
      <th>Amount</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<table class="totals-table">
  <tbody>
    <tr>
      <td>Subtotal</td>
      <td style="text-align:right">${formatCurrency(data.totalAmount)}</td>
    </tr>
    ${parseFloat(data.discountAmount) > 0 ? `<tr><td>Discount</td><td style="text-align:right">- ${formatCurrency(data.discountAmount)}</td></tr>` : ''}
    ${gstSection}
    <tr class="total-row">
      <td>Total</td>
      <td style="text-align:right">${formatCurrency(data.finalAmount)}</td>
    </tr>
  </tbody>
</table>

${data.notes ? `<div style="margin-top:16px;padding:10px 14px;background:#faf7f0;border-radius:5px;font-size:11px;color:#666;border-left:3px solid #C9972A;"><strong>Notes:</strong> ${data.notes}</div>` : ''}

<div class="footer">
  <div class="note">
    Thank you for choosing <strong>${data.shopName}</strong>.<br/>
    This is a computer-generated invoice.
  </div>
  <div class="signature">
    <div class="signature-line"></div>
    <small>Authorized Signatory</small>
  </div>
</div>
</body>
</html>`;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<string> {
  const dir = path.join(env.UPLOADS_DIR, 'invoices');
  ensureDir(dir);

  const filename = `${data.invoiceNo}.pdf`;
  const filePath = path.join(dir, filename);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const html = buildHtml(data);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: filePath, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  } finally {
    await browser.close();
  }

  return `${env.PUBLIC_URL}/uploads/invoices/${filename}`;
}

export type { InvoiceData };

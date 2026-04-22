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
  shopBankAccount: string;
  shopBankName: string;
  shopBankBranch: string;
  shopBankIfsc: string;
  shopTerms: string;
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  transactionNo: string;
  transactionDate: string;
  paymentDate: string;
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
    metalType: string | null;
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
  const printTime = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const fmt = (v: string | number | null | undefined, digits = 2): string => {
    const n = parseFloat(String(v ?? '0')) || 0;
    return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  // Computed totals
  const subtotal   = parseFloat(data.totalAmount)    || 0;
  const discount   = parseFloat(data.discountAmount) || 0;
  const taxable    = subtotal - discount;
  const cgstAmt    = data.gstEnabled ? (parseFloat(data.taxAmount) || 0) / 2 : 0;
  const sgstAmt    = data.gstEnabled ? (parseFloat(data.taxAmount) || 0) / 2 : 0;
  const preRound   = taxable + cgstAmt + sgstAmt;
  const finalAmt   = parseFloat(data.finalAmount) || 0;
  const amountPaid = parseFloat(data.amountPaid)  || 0;
  const balance    = finalAmt - amountPaid;

  const isGst = data.gstEnabled;

  const logoHtml = data.logoUrl
    ? `<img src="${data.logoUrl}" alt="Logo" style="height:64px;object-fit:contain;" />`
    : `<div style="width:54px;height:54px;background:#C9972A;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-family:'Cormorant Garamond',serif;font-weight:700;flex-shrink:0;">J</div>`;

  // Item rows: # | Item (purity sub-line) | Qty | G.Wt | Rate/g | Making | Amount
  const itemRows = data.items.map((item, i) => {
    const grossWt     = parseFloat(item.weightG    ?? '0') || 0;
    const ratePerG    = parseFloat(item.ratePerGram ?? '0') || 0;
    const totalPrice  = parseFloat(item.totalPrice  ?? '0') || 0;
    const stoneCharge = parseFloat(item.stoneCharge ?? '0') || 0;
    const metalValue  = ratePerG * grossWt;
    const makingValue = totalPrice - metalValue - stoneCharge;
    const makingPct   = metalValue > 0 ? (makingValue / metalValue) * 100 : 0;

    return `
      <tr class="${item.isExchangeItem ? 'xrow' : ''}">
        <td class="c dim">${i + 1}</td>
        <td>
          <span class="item-name">${item.productName}</span>
          ${item.isExchangeItem ? ' <span class="badge">Exchange</span>' : ''}
          ${item.purity ? `<div class="purity-sub">${item.purity}</div>` : ''}
        </td>
        <td class="c">${item.quantity}</td>
        <td class="r">${grossWt > 0 ? grossWt.toFixed(3) : '&mdash;'}</td>
        <td class="r">${ratePerG > 0 ? fmt(ratePerG) : '&mdash;'}</td>
        <td class="c">${makingPct > 0 ? makingPct.toFixed(2) + '%' : (makingValue > 0 ? '&#x20B9;' + fmt(makingValue) : '&mdash;')}</td>
        <td class="r amount">${fmt(item.totalPrice)}</td>
      </tr>`;
  }).join('');

  const termsLines = (data.shopTerms || '')
    .split('\n').filter(Boolean)
    .map((l, i) => `<li>${l.replace(/^[\d]+[-.\s]*/, '').trim()}</li>`)
    .join('');

  const hasBankDetails = !!(data.shopBankAccount || data.shopBankName || data.shopBankIfsc || data.shopBankBranch);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; font-size: 11.5px; color: #1c1209; background: #fff; position: relative; }

  /* ── Print timestamp — very faint, top-right corner ── */
  .print-time { position: absolute; top: 10px; right: 22px; font-size: 9px;
    color: #1c1209; opacity: 0.13; letter-spacing: 0.3px; }

  /* ── Page wrapper ── */
  .page { padding: 22px 24px 24px; min-height: 297mm; display: flex; flex-direction: column; }
  .page-body { flex: 1; }
  .page-bottom { margin-top: auto; padding-top: 12px; }

  /* ── Shop header ── */
  .shop-header { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #C9972A; padding-bottom: 14px; margin-bottom: 14px; gap: 20px; }
  .shop-left   { display: flex; gap: 14px; align-items: flex-start; flex: 1; min-width: 0; }
  .shop-name   { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 700;
    color: #C9972A; line-height: 1; letter-spacing: 0.5px; }
  .shop-info   { font-size: 10.5px; color: #555; line-height: 1.7; margin-top: 4px; max-width: 240px; }
  .shop-right  { flex-shrink: 0; text-align: right; min-width: 190px; }
  .inv-title   { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 700;
    color: #8B6914; letter-spacing: 0.5px; }
  .gst-badge   { display: inline-block; background: #C9972A; color: #fff; font-size: 10px;
    font-weight: 700; padding: 2px 10px; border-radius: 4px; margin-top: 3px;
    font-family: 'Cormorant Garamond', serif; letter-spacing: 1px; }
  .hdr-meta    { margin-top: 8px; border-collapse: collapse; width: 100%; }
  .hdr-meta td { padding: 2px 0; font-size: 10.5px; vertical-align: top; }
  .hdr-meta .lbl { color: #aaa; font-size: 9.5px; padding-left: 10px; white-space: nowrap; text-align: left; }
  .hdr-meta .val { font-weight: 600; color: #1c1209; text-align: right; }
  .copy-stamp  { display: inline-block; border: 1.5px solid #C9972A; color: #C9972A;
    font-size: 8px; font-weight: 700; letter-spacing: 1.2px; padding: 2px 8px;
    border-radius: 3px; margin-top: 7px; }

  /* ── Parties row ── */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .party-box { background: #faf7f0; border: 1px solid #ead9b0; border-radius: 6px; padding: 11px 14px; }
  .party-box .ph { font-size: 9.5px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.6px; color: #C9972A; margin-bottom: 7px;
    border-bottom: 1px solid #ead9b0; padding-bottom: 5px; }
  .bill-table { width: 100%; border-collapse: collapse; }
  .bill-table td { padding: 1.5px 0; font-size: 11px; vertical-align: top; }
  .bill-table .lbl { color: #999; font-size: 10px; width: 52px; padding-right: 8px; white-space: nowrap; }
  .bill-table .val { max-width: 160px; word-break: break-word; overflow-wrap: break-word; }
  .bill-name { font-family: 'Cormorant Garamond', serif; font-size: 15px; font-weight: 700; color: #1c1209; }
  .pay-row   { display: flex; justify-content: space-between; padding: 3.5px 0;
    font-size: 11px; color: #444; border-bottom: 1px dotted #ead9b0; }
  .pay-row:last-child { border-bottom: none; }
  .pay-row .pl { color: #888; font-size: 10.5px; }
  .pay-row .pv { font-weight: 500; }
  .pay-row.paid { font-weight: 700; color: #8B6914; font-size: 12px;
    border-top: 1.5px solid #C9972A; border-bottom: none; padding-top: 6px; margin-top: 3px; }
  .pay-row.bal  { color: #c0392b; font-weight: 600; border-bottom: none; }

  /* ── Items table ── */
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
  table.items thead tr { background: #C9972A; color: #fff; }
  table.items thead th { padding: 7px 8px; font-weight: 600; font-size: 10px; white-space: nowrap; text-align: left; }
  table.items thead th.c { text-align: center; }
  table.items thead th.r { text-align: right; }
  table.items tbody tr { border-bottom: 1px solid #ede5d0; }
  table.items tbody tr:nth-child(even) { background: #fdfaf5; }
  table.items tbody td { padding: 7px 8px; vertical-align: middle; }
  table.items .c    { text-align: center; }
  table.items .r    { text-align: right; }
  table.items .dim  { color: #bbb; font-size: 10px; }
  .item-name  { font-weight: 500; }
  .purity-sub { font-size: 9.5px; color: #aaa; margin-top: 2px; letter-spacing: 0.3px; }
  .amount     { font-weight: 600; font-size: 11.5px; }
  .badge     { display: inline-block; background: #C9972A; color: #fff; font-size: 8px;
    padding: 1px 5px; border-radius: 3px; vertical-align: middle; margin-left: 3px; }
  .xrow      { background: #fff9ea !important; }

  /* ── Lower section: notes left, totals right ── */
  .lower { display: flex; gap: 16px; margin-top: 2px; align-items: start; }
  .lower-left { flex: 1; min-width: 0; }

  /* ── Totals ── */
  .totals { background: #faf7f0; border: 1px solid #ead9b0; border-radius: 6px; padding: 11px 14px; width: 240px; flex-shrink: 0; }
  .trow   { display: flex; justify-content: space-between; padding: 3px 0;
    font-size: 11px; }
  .trow .tl { color: #666; }
  .trow .tv { font-weight: 600; min-width: 80px; text-align: right; }
  .trow.hi  { background: #f3ead5; margin: 2px -4px; padding: 4px 4px;
    border-radius: 3px; border-bottom: none; }
  .trow.grand { font-family: 'Cormorant Garamond', serif; font-size: 15px; font-weight: 700;
    border-top: 2px solid #C9972A; border-bottom: none; padding-top: 7px;
    margin-top: 3px; color: #8B6914; }

  /* ── Notes ── */
  .notes-box { margin-top: 10px; padding: 8px 12px; background: #faf7f0;
    border-left: 3px solid #C9972A; border-radius: 0 4px 4px 0; font-size: 10.5px; color: #555; }

  /* ── Terms + Bank ── */
  .tb-wrap      { display: flex; gap: 16px; margin-top: 16px; padding-top: 13px;
    border-top: 1px solid #ead9b0; align-items: flex-start; }
  .tb-box       { flex: 1; }
  .tb-box.full  { flex: 1; }
  .tb-box .ph   { font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.6px; color: #8B6914; margin-bottom: 7px;
    padding-bottom: 4px; border-bottom: 1px solid #ead9b0; }
  .tb-box ol    { padding-left: 16px; margin: 0; }
  .tb-box li    { font-size: 10px; color: #555; margin-bottom: 3px; line-height: 1.5; }
  .bank-tbl     { width: 100%; border-collapse: collapse; }
  .bank-tbl td  { padding: 2.5px 0; font-size: 10.5px; vertical-align: top; }
  .bank-lbl     { color: #999; font-size: 10px; width: 72px; padding-right: 8px; white-space: nowrap; }
  .bank-val     { font-weight: 500; color: #333; word-break: break-all; }

  /* ── Signatures ── */
  .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;
    margin-top: 20px; padding-top: 10px; border-top: 1px solid #ead9b0; }
  .sig-cell { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .sig-line { border-top: 1px solid #bbb; width: 110px; margin-bottom: 5px; margin-top: 32px; }
  .sig-lbl  { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #777; }
  .thanks   { font-family: 'Cormorant Garamond', serif; font-size: 15px; font-weight: 700; color: #C9972A; }
  .thanks-sub { font-size: 9.5px; color: #aaa; margin-top: 3px; }

  /* ── Footer ── */
  .foot { display: flex; justify-content: space-between; align-items: center;
    border-top: 2px solid #C9972A; margin-top: 14px; padding-top: 7px; gap: 12px; }
  .foot-contact { font-size: 9.5px; color: #777; flex: 1; }
  .foot-addr    { font-size: 9.5px; color: #777; text-align: center; flex: 1; }
  .foot-label   { font-family: 'Cormorant Garamond', serif; font-size: 11px;
    font-weight: 700; color: #C9972A; text-align: right; flex: 1; }
  .computer-gen { font-size: 8.5px; color: #bbb; text-align: center; margin-top: 5px; letter-spacing: 0.3px; }
</style>
</head>
<body>

<!-- Faint print time — top right, almost invisible -->
<div class="print-time">${printTime}</div>

<div class="page">
<div class="page-body">

  <!-- ── Header ── -->
  <div class="shop-header">
    <div class="shop-left">
      ${logoHtml}
      <div>
        <div class="shop-name">${data.shopName}</div>
        <div class="shop-info">
          ${data.shopAddress ? data.shopAddress + '<br/>' : ''}
          ${data.shopPhone   ? 'Contact : ' + data.shopPhone + (data.shopEmail ? ' &nbsp;|&nbsp; ' + data.shopEmail : '') + '<br/>' : ''}
          ${data.shopGstin   ? 'GSTIN : ' + data.shopGstin : ''}
        </div>
      </div>
    </div>
    <div class="shop-right">
      <div class="inv-title">${isGst ? 'TAX INVOICE' : 'INVOICE'}</div>
      ${isGst ? '<div class="gst-badge">GST INVOICE</div>' : ''}
      <table class="hdr-meta">
        <tr><td class="lbl">Invoice No</td><td class="val">${data.invoiceNo}</td></tr>
        <tr><td class="lbl">Date</td><td class="val">${data.invoiceDate}</td></tr>
        <tr><td class="lbl">Ref No</td><td class="val">${data.transactionNo}</td></tr>
        ${data.shopGstin ? `<tr><td class="lbl">GSTIN</td><td class="val">${data.shopGstin}</td></tr>` : ''}
      </table>
      <div><span class="copy-stamp">CUSTOMER COPY</span></div>
    </div>
  </div>

  <!-- ── Parties: Bill-To + Payment Details ── -->
  <div class="parties">
    <div class="party-box">
      <div class="ph">Billed To</div>
      <table class="bill-table">
        <tr>
          <td class="lbl">Name</td>
          <td class="bill-name">${data.customer?.name ?? 'Walk-in Customer'}</td>
        </tr>
        ${data.customer?.address ? `<tr><td class="lbl">Address</td><td>${data.customer.address}</td></tr>` : ''}
        ${data.customer?.phone   ? `<tr><td class="lbl">Phone</td><td>${data.customer.phone}</td></tr>` : ''}
        ${data.customer?.email   ? `<tr><td class="lbl">Email</td><td>${data.customer.email}</td></tr>` : ''}
      </table>
    </div>
    <div class="party-box">
      <div class="ph">Payment Details</div>
      <div class="pay-row">
        <span class="pl">Method</span>
        <span class="pv">${(data.paymentMethod ?? 'Not Specified').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
      </div>
      <div class="pay-row">
        <span class="pl">Payment Date</span>
        <span class="pv">${data.paymentDate}</span>
      </div>
      ${amountPaid > 0 ? `
      <div class="pay-row paid">
        <span>Amount Received</span>
        <span>&#x20B9;&nbsp;${fmt(amountPaid)}</span>
      </div>` : ''}
      ${balance > 0.005 ? `
      <div class="pay-row bal">
        <span>Balance Due</span>
        <span>&#x20B9;&nbsp;${fmt(balance)}</span>
      </div>` : `
      <div class="pay-row paid">
        <span>Status</span>
        <span style="color:#27ae60">&#10003; Paid</span>
      </div>`}
    </div>
  </div>

  <!-- ── Items Table ── -->
  <table class="items">
    <thead>
      <tr>
        <th class="c" style="width:26px">#</th>
        <th>Item</th>
        <th class="c" style="width:40px">Qty</th>
        <th class="r" style="width:70px">G.Wt (g)</th>
        <th class="r" style="width:82px">Rate /g</th>
        <th class="c" style="width:72px">Making</th>
        <th class="r" style="width:82px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- ── Lower: Notes + Totals ── -->
  <div class="lower">
    <div class="lower-left">
      ${data.notes ? `<div class="notes-box"><strong>Note:</strong> ${data.notes}</div>` : ''}
    </div>

    <!-- Totals -->
    <div class="totals">
      <div class="trow">
        <span class="tl">Subtotal</span>
        <span class="tv">${fmt(subtotal)}</span>
      </div>
      ${discount > 0 ? `
        <div class="trow">
          <span class="tl">Discount</span>
          <span class="tv">&minus;&nbsp;${fmt(discount)}</span>
        </div>` : ''}
      ${(discount > 0 || isGst) ? `
        <div class="trow hi">
          <span class="tl">Taxable Value</span>
          <span class="tv">${fmt(taxable)}</span>
        </div>` : ''}
      ${isGst ? `
        <div class="trow">
          <span class="tl">CGST (${data.cgstRate}%)</span>
          <span class="tv">${fmt(cgstAmt)}</span>
        </div>
        <div class="trow">
          <span class="tl">SGST (${data.sgstRate}%)</span>
          <span class="tv">${fmt(sgstAmt)}</span>
        </div>
        <div class="trow hi">
          <span class="tl">Sub Total</span>
          <span class="tv">${fmt(preRound)}</span>
        </div>` : ''}
<div class="trow grand">
        <span>Total</span>
        <span>&#x20B9;&nbsp;${fmt(finalAmt)}</span>
      </div>
    </div>
  </div>

</div><!-- end page-body -->
<div class="page-bottom">

  <!-- ── Terms & Bank Details ── -->
  ${(termsLines || hasBankDetails) ? `
  <div class="tb-wrap">
    ${termsLines ? `
    <div class="tb-box${!hasBankDetails ? ' full' : ''}">
      <div class="ph">Terms &amp; Conditions</div>
      <ol>${termsLines}</ol>
    </div>` : ''}
    ${hasBankDetails ? `
    <div class="tb-box${!termsLines ? ' full' : ''}">
      <div class="ph">Bank Details</div>
      <table class="bank-tbl">
        ${data.shopBankName    ? `<tr><td class="bank-lbl">Bank</td><td class="bank-val">${data.shopBankName}</td></tr>` : ''}
        ${data.shopBankBranch  ? `<tr><td class="bank-lbl">Branch</td><td class="bank-val">${data.shopBankBranch}</td></tr>` : ''}
        ${data.shopBankAccount ? `<tr><td class="bank-lbl">A/C No.</td><td class="bank-val">${data.shopBankAccount}</td></tr>` : ''}
        ${data.shopBankIfsc    ? `<tr><td class="bank-lbl">IFSC</td><td class="bank-val">${data.shopBankIfsc}</td></tr>` : ''}
      </table>
    </div>` : ''}
  </div>` : ''}

  <!-- ── Signatures ── -->
  <div class="sigs">
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-lbl">Customer Signatory</div>
    </div>
    <div class="sig-cell" style="justify-self:center;padding-top:10px;">
      <div class="thanks">Thank You For Your Business!</div>
      ${data.shopEmail ? `<div class="thanks-sub">${data.shopEmail}</div>` : ''}
    </div>
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-lbl">Authorised Signatory</div>
    </div>
  </div>

  <!-- ── Page Footer ── -->
  <div class="foot">
    <div class="foot-contact">
      ${[data.shopPhone, data.shopEmail].filter(Boolean).join('  |  ')}
    </div>
    ${data.shopAddress ? `<div class="foot-addr">${data.shopAddress}</div>` : '<div></div>'}
    <div class="foot-label">${isGst ? 'GST INVOICE' : 'INVOICE'}</div>
  </div>
  <div class="computer-gen">This is a computer-generated invoice</div>

</div><!-- end page-bottom -->
</div><!-- end page -->
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
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
  } finally {
    await browser.close();
  }

  return `${env.PUBLIC_URL}/uploads/invoices/${filename}`;
}

export type { InvoiceData };

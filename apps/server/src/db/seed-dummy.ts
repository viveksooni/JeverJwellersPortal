/**
 * Dummy data seed — realistic jewelry shop data for all tables.
 * Run: npx tsx src/db/seed-dummy.ts
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as schema from './schema.js';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dateStr(daysBack: number): string {
  return daysAgo(daysBack).toISOString().split('T')[0];
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Counters for sequential numbers ────────────────────────────────────────
let txnCounter = 1000;
let invCounter = 500;

function nextTxnNo() { return `TXN-${++txnCounter}`; }
function nextInvNo() { return `INV-${++invCounter}`; }

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Starting dummy data seed...\n');

  // ── 1. Metal rate history (last 60 days) ──────────────────────────────────
  console.log('📈 Seeding metal rate history...');
  const goldBase22 = 6233;
  const silverBase = 85;

  const rateRows: any[] = [];
  for (let i = 60; i >= 0; i--) {
    const jitter = (n: number, pct: number) =>
      (n * (1 + (Math.random() - 0.5) * pct)).toFixed(2);
    const d = dateStr(i);
    const g22 = parseFloat(jitter(goldBase22, 0.04));
    const g24 = (g22 * (24 / 22)).toFixed(2);
    const g18 = (g22 * (18 / 22)).toFixed(2);
    const g14 = (g22 * (14 / 22)).toFixed(2);
    const s999 = parseFloat(jitter(silverBase, 0.05));
    const s925 = (s999 * 0.925).toFixed(2);
    const pt = jitter(3200, 0.03);

    rateRows.push(
      { metalType: 'gold_24k', ratePerGram: g24, effectiveDate: d },
      { metalType: 'gold_22k', ratePerGram: String(g22), effectiveDate: d },
      { metalType: 'gold_18k', ratePerGram: g18, effectiveDate: d },
      { metalType: 'gold_14k', ratePerGram: g14, effectiveDate: d },
      { metalType: 'silver_999', ratePerGram: String(s999), effectiveDate: d },
      { metalType: 'silver_925', ratePerGram: s925, effectiveDate: d },
      { metalType: 'platinum_950', ratePerGram: pt, effectiveDate: d },
    );
  }
  for (const r of rateRows) {
    await db.insert(schema.metalRates).values(r).onConflictDoNothing();
  }
  console.log(`   ✓ ${rateRows.length} rate entries`);

  // ── 2. Customers ───────────────────────────────────────────────────────────
  console.log('👥 Seeding customers...');
  const customerData = [
    { name: 'Rajesh Kumar',      phone: '9876543210', email: 'rajesh.kumar@gmail.com',   address: '12, MG Road, Jaipur, Rajasthan 302001',            notes: 'Regular customer, prefers gold' },
    { name: 'Priya Sharma',      phone: '9865432109', email: 'priya.sharma@yahoo.com',   address: '45, Civil Lines, Agra, UP 282002',                  notes: 'Interested in diamond sets' },
    { name: 'Amit Verma',        phone: '9754321098', email: 'amit.verma@hotmail.com',   address: '78, Lal Darwaza, Surat, Gujarat 395003',            notes: '' },
    { name: 'Sunita Agarwal',    phone: '9643210987', email: 'sunita.agarwal@gmail.com', address: '3, Park Street, Kolkata, WB 700016',               notes: 'Buying for daughter wedding' },
    { name: 'Deepak Mehta',      phone: '9532109876', email: 'deepak.mehta@gmail.com',   address: '22, Sarojini Nagar, Lucknow, UP 226008',            notes: '' },
    { name: 'Kavita Patel',      phone: '9421098765', email: 'kavita.patel@rediffmail.com', address: '67, Vastrapur, Ahmedabad, Gujarat 380015',       notes: 'Wholesale buyer' },
    { name: 'Suresh Nair',       phone: '9310987654', email: 'suresh.nair@gmail.com',    address: '9, Connaught Place, New Delhi 110001',              notes: 'Corporate gifting customer' },
    { name: 'Meena Joshi',       phone: '9209876543', email: 'meena.joshi@gmail.com',    address: '101, Banjara Hills, Hyderabad, TS 500034',          notes: '' },
    { name: 'Ravi Shankar',      phone: '9098765432', email: 'ravi.shankar@gmail.com',   address: '55, Anna Nagar, Chennai, TN 600040',               notes: 'Prefers silver jewelry' },
    { name: 'Anita Desai',       phone: '8987654321', email: 'anita.desai@gmail.com',    address: '14, FC Road, Pune, Maharashtra 411004',            notes: 'Anniversary purchase yearly' },
    { name: 'Vikram Singh',      phone: '8876543210', email: 'vikram.singh@outlook.com', address: '33, Sector 17, Chandigarh 160017',                 notes: '' },
    { name: 'Pooja Kapoor',      phone: '8765432109', email: 'pooja.kapoor@gmail.com',   address: '8, Malviya Nagar, Jaipur, Rajasthan 302017',       notes: 'Bridal set inquiry' },
    { name: 'Manoj Tiwari',      phone: '8654321098', email: 'manoj.tiwari@gmail.com',   address: '29, Hazratganj, Lucknow, UP 226001',               notes: '' },
    { name: 'Nisha Gupta',       phone: '8543210987', email: 'nisha.gupta@gmail.com',    address: '72, Model Town, Amritsar, Punjab 143001',          notes: 'Repair customer' },
    { name: 'Arun Saxena',       phone: '8432109876', email: 'arun.saxena@gmail.com',    address: '19, Tilak Nagar, Kanpur, UP 208002',               notes: '' },
  ];

  const insertedCustomers = await db.insert(schema.customers).values(
    customerData.map(c => ({
      ...c,
      createdAt: daysAgo(rand(5, 60)),
      updatedAt: new Date(),
    }))
  ).returning();
  console.log(`   ✓ ${insertedCustomers.length} customers`);

  // ── 3. Categories (ensure they exist) ─────────────────────────────────────
  await db.insert(schema.categories).values([
    { name: 'Gold',     description: 'Gold jewelry items' },
    { name: 'Silver',   description: 'Silver jewelry items' },
    { name: 'Diamond',  description: 'Diamond jewelry items' },
    { name: 'Platinum', description: 'Platinum jewelry items' },
    { name: 'Other',    description: 'Other jewelry items' },
  ]).onConflictDoNothing();

  const cats = await db.query.categories.findMany();
  const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

  // ── 4. Products ────────────────────────────────────────────────────────────
  console.log('💍 Seeding products...');
  const productDefs = [
    // Gold
    { name: 'Ladies Gold Mangalsutra', sku: 'GLD-001', categoryId: catMap['Gold'],    metalType: 'gold', purity: '22k', grossWeightG: '8.500', netWeightG: '7.800', makingCharge: '1800', makingType: 'flat',     description: 'Traditional black bead mangalsutra in 22k gold' },
    { name: 'Gold Wedding Band',       sku: 'GLD-002', categoryId: catMap['Gold'],    metalType: 'gold', purity: '18k', grossWeightG: '5.200', netWeightG: '5.000', makingCharge: '900',  makingType: 'flat',     description: 'Plain 18k gold wedding band for men' },
    { name: 'Gold Stud Earrings',      sku: 'GLD-003', categoryId: catMap['Gold'],    metalType: 'gold', purity: '22k', grossWeightG: '3.100', netWeightG: '2.900', makingCharge: '600',  makingType: 'flat',     description: 'Classic round gold studs' },
    { name: 'Lakshmi Coin Pendant',    sku: 'GLD-004', categoryId: catMap['Gold'],    metalType: 'gold', purity: '24k', grossWeightG: '2.000', netWeightG: '2.000', makingCharge: '0',    makingType: 'flat',     description: '2g pure gold Lakshmi coin with bail' },
    { name: 'Gold Bangle Pair',        sku: 'GLD-005', categoryId: catMap['Gold'],    metalType: 'gold', purity: '22k', grossWeightG: '24.000', netWeightG: '22.500', makingCharge: '350', makingType: 'per_gram', description: 'Plain gold bangle pair in 22k' },
    { name: 'Gold Chain 18 inch',      sku: 'GLD-006', categoryId: catMap['Gold'],    metalType: 'gold', purity: '18k', grossWeightG: '7.800', netWeightG: '7.600', makingCharge: '280',  makingType: 'per_gram', description: 'Anchor link gold chain 18 inches' },
    { name: 'Gold Nose Pin',           sku: 'GLD-007', categoryId: catMap['Gold'],    metalType: 'gold', purity: '22k', grossWeightG: '0.800', netWeightG: '0.750', makingCharge: '250',  makingType: 'flat',     description: 'Small round gold nose pin' },
    { name: 'Gold Kada (Bracelet)',    sku: 'GLD-008', categoryId: catMap['Gold'],    metalType: 'gold', purity: '22k', grossWeightG: '18.000', netWeightG: '16.500', makingCharge: '320', makingType: 'per_gram', description: 'Mens plain gold kada' },

    // Silver
    { name: 'Silver Payal (Anklet)',   sku: 'SLV-001', categoryId: catMap['Silver'],  metalType: 'silver', purity: '925', grossWeightG: '35.000', netWeightG: '33.000', makingCharge: '12', makingType: 'per_gram', description: 'Sterling silver anklet pair with bells' },
    { name: 'Silver Om Pendant',       sku: 'SLV-002', categoryId: catMap['Silver'],  metalType: 'silver', purity: '999', grossWeightG: '8.500', netWeightG: '8.200', makingCharge: '8',  makingType: 'per_gram', description: 'Pure silver Om pendant with chain' },
    { name: 'Silver Toe Ring',         sku: 'SLV-003', categoryId: catMap['Silver'],  metalType: 'silver', purity: '925', grossWeightG: '2.500', netWeightG: '2.300', makingCharge: '5',  makingType: 'per_gram', description: 'Traditional silver toe ring pair' },
    { name: 'Silver Ganesh Idol',      sku: 'SLV-004', categoryId: catMap['Silver'],  metalType: 'silver', purity: '999', grossWeightG: '50.000', netWeightG: '50.000', makingCharge: '0', makingType: 'flat',    description: '50g pure silver Ganesh idol for gifting' },
    { name: 'Silver Coin 10g',         sku: 'SLV-005', categoryId: catMap['Silver'],  metalType: 'silver', purity: '999', grossWeightG: '10.000', netWeightG: '10.000', makingCharge: '0', makingType: 'flat',    description: '10g 999 purity silver coin' },

    // Diamond
    { name: 'Diamond Solitaire Ring',  sku: 'DIA-001', categoryId: catMap['Diamond'], metalType: 'gold', purity: '18k', grossWeightG: '4.500', netWeightG: '3.800', stoneType: 'Diamond', stoneWeightCt: '0.3000', makingCharge: '4500', makingType: 'flat', description: '0.30 ct solitaire diamond ring in 18k gold' },
    { name: 'Diamond Hoop Earrings',   sku: 'DIA-002', categoryId: catMap['Diamond'], metalType: 'gold', purity: '18k', grossWeightG: '3.200', netWeightG: '2.600', stoneType: 'Diamond', stoneWeightCt: '0.1500', makingCharge: '3200', makingType: 'flat', description: 'Small diamond hoop earrings' },
    { name: 'Diamond Necklace Set',    sku: 'DIA-003', categoryId: catMap['Diamond'], metalType: 'gold', purity: '18k', grossWeightG: '12.000', netWeightG: '10.500', stoneType: 'Diamond', stoneWeightCt: '0.8000', makingCharge: '12000', makingType: 'flat', description: 'Bridal diamond necklace set with earrings' },
    { name: 'Diamond Bracelet',        sku: 'DIA-004', categoryId: catMap['Diamond'], metalType: 'gold', purity: '14k', grossWeightG: '6.800', netWeightG: '5.900', stoneType: 'Diamond', stoneWeightCt: '0.2500', makingCharge: '5500', makingType: 'flat', description: 'Tennis bracelet with small diamond accents' },

    // Platinum
    { name: 'Platinum Wedding Band',   sku: 'PLT-001', categoryId: catMap['Platinum'], metalType: 'platinum', purity: '950', grossWeightG: '8.000', netWeightG: '7.800', makingCharge: '3500', makingType: 'flat', description: 'Classic platinum wedding band Pt950' },
    { name: 'Platinum Couple Rings',   sku: 'PLT-002', categoryId: catMap['Platinum'], metalType: 'platinum', purity: '950', grossWeightG: '14.000', netWeightG: '13.500', makingCharge: '5000', makingType: 'flat', description: 'Platinum couple ring set' },
  ];

  const insertedProducts = await db.insert(schema.products).values(productDefs as any).returning();
  console.log(`   ✓ ${insertedProducts.length} products`);

  // ── 5. Inventory ───────────────────────────────────────────────────────────
  console.log('📦 Seeding inventory...');
  const inventoryData = insertedProducts.map((p) => ({
    productId: p.id,
    quantity: rand(2, 20),
    totalWeightG: (parseFloat(p.grossWeightG ?? '0') * rand(2, 20)).toFixed(4),
    minStockAlert: 2,
    location: pick(['Showcase A', 'Showcase B', 'Showcase C', 'Safe', 'Display Window']),
    lastUpdated: new Date(),
  }));
  await db.insert(schema.inventory).values(inventoryData).onConflictDoNothing();
  console.log(`   ✓ ${inventoryData.length} inventory rows`);

  // ── 6. Inventory movements (opening stock) ────────────────────────────────
  console.log('🔄 Seeding inventory movements (opening stock)...');
  const openingMovements = insertedProducts.map((p, i) => ({
    productId: p.id,
    movementType: 'adjustment',
    quantity: inventoryData[i].quantity,
    weightG: inventoryData[i].totalWeightG,
    notes: 'Opening stock',
    createdAt: daysAgo(rand(30, 60)),
  }));
  await db.insert(schema.inventoryMovements).values(openingMovements as any);
  console.log(`   ✓ ${openingMovements.length} opening stock entries`);

  // ── 7. Transactions, Items, Invoices, Repairs ─────────────────────────────
  console.log('🧾 Seeding transactions...');

  // Helper: compute price for a product
  function productPrice(p: typeof insertedProducts[0], g22Rate = 6233, sRate = 85): number {
    const gross = parseFloat(p.grossWeightG ?? '0');
    const making = parseFloat(p.makingCharge ?? '0');
    const mt = p.makingType ?? 'flat';
    let metal = 0;
    if (p.metalType === 'gold') {
      const rateMap: Record<string, number> = { '24k': g22Rate * (24/22), '22k': g22Rate, '18k': g22Rate * (18/22), '14k': g22Rate * (14/22) };
      metal = gross * (rateMap[p.purity ?? '22k'] ?? g22Rate);
    } else if (p.metalType === 'silver') {
      metal = gross * sRate;
    } else if (p.metalType === 'platinum') {
      metal = gross * 3200;
    }
    const mc = mt === 'per_gram' ? making * gross : mt === 'percentage' ? metal * making / 100 : making;
    return Math.round(metal + mc);
  }

  let txnCount = 0;
  let invCount = 0;
  let repairCount = 0;

  // ─── SALES (35 transactions spread over 60 days) ───────────────────────────
  const saleDays = [1,1,2,3,3,4,5,6,6,7,8,9,10,11,12,12,14,15,16,17,18,20,21,22,24,25,27,28,30,33,35,38,42,50,58];
  for (const dBack of saleDays) {
    const customer = pick(insertedCustomers);
    const product = pick(insertedProducts.filter(p => p.metalType !== 'platinum'));
    const qty = rand(1, 2);
    const g22 = goldBase22 * (1 + (Math.random()-0.5)*0.03);
    const unitPrice = productPrice(product, g22);
    const total = unitPrice * qty;
    const discount = rand(0, 1) === 1 ? rand(100, 500) : 0;
    const finalAmt = Math.max(total - discount, total * 0.95);
    const txnNo = nextTxnNo();
    const txnDate = daysAgo(dBack);
    const payStatus = pick(['paid', 'paid', 'paid', 'partial']);
    const payMethod = pick(['cash', 'upi', 'card', 'bank_transfer']);

    const [txn] = await db.insert(schema.transactions).values({
      transactionNo: txnNo,
      type: 'sale',
      status: 'completed',
      customerId: customer.id,
      totalAmount: String(total),
      discountAmount: String(discount),
      taxAmount: '0',
      finalAmount: String(Math.round(finalAmt)),
      paymentMethod: payMethod,
      paymentStatus: payStatus,
      amountPaid: payStatus === 'paid' ? String(Math.round(finalAmt)) : String(Math.round(finalAmt * 0.5)),
      goldRate: g22.toFixed(2),
      silverRate: (silverBase * (1 + (Math.random()-0.5)*0.05)).toFixed(2),
      transactionDate: txnDate,
      createdAt: txnDate,
      updatedAt: txnDate,
    } as any).returning();

    await db.insert(schema.transactionItems).values({
      transactionId: txn.id,
      productId: product.id,
      productName: product.name,
      quantity: qty,
      weightG: String(parseFloat(product.grossWeightG ?? '0') * qty),
      purity: product.purity,
      ratePerGram: g22.toFixed(2),
      makingCharge: product.makingCharge,
      stoneCharge: '0',
      unitPrice: String(unitPrice),
      totalPrice: String(total),
      isExchangeItem: false,
    });

    // inventory movement: stock out
    await db.insert(schema.inventoryMovements).values({
      productId: product.id,
      movementType: 'sale',
      quantity: -qty,
      weightG: String(parseFloat(product.grossWeightG ?? '0') * qty),
      referenceId: txn.id,
      notes: `Sale ${txnNo}`,
      createdAt: txnDate,
    } as any);

    // create invoice
    const invNo = nextInvNo();
    await db.insert(schema.invoices).values({
      invoiceNo: invNo,
      transactionId: txn.id,
      customerId: customer.id,
      pdfUrl: null,
      whatsappSent: rand(0,1) === 1,
      gstEnabled: false,
      issuedAt: txnDate,
    } as any);

    txnCount++;
    invCount++;
  }

  // ─── PURCHASES from vendor (10 transactions) ──────────────────────────────
  for (let i = 0; i < 10; i++) {
    const product = pick(insertedProducts);
    const qty = rand(3, 8);
    const unitPrice = Math.round(productPrice(product) * 0.9); // buy cheaper
    const total = unitPrice * qty;
    const txnNo = nextTxnNo();
    const txnDate = daysAgo(rand(5, 55));

    const [txn] = await db.insert(schema.transactions).values({
      transactionNo: txnNo,
      type: 'purchase',
      status: 'completed',
      customerId: null,
      totalAmount: String(total),
      discountAmount: '0',
      taxAmount: '0',
      finalAmount: String(total),
      paymentMethod: pick(['cash', 'bank_transfer', 'cheque']),
      paymentStatus: 'paid',
      amountPaid: String(total),
      notes: `Stock purchase from vendor`,
      goldRate: String(goldBase22),
      silverRate: String(silverBase),
      transactionDate: txnDate,
      createdAt: txnDate,
      updatedAt: txnDate,
    } as any).returning();

    await db.insert(schema.transactionItems).values({
      transactionId: txn.id,
      productId: product.id,
      productName: product.name,
      quantity: qty,
      weightG: String(parseFloat(product.grossWeightG ?? '0') * qty),
      purity: product.purity,
      ratePerGram: String(goldBase22),
      makingCharge: product.makingCharge,
      stoneCharge: '0',
      unitPrice: String(unitPrice),
      totalPrice: String(total),
      isExchangeItem: false,
    });

    await db.insert(schema.inventoryMovements).values({
      productId: product.id,
      movementType: 'purchase',
      quantity: qty,
      weightG: String(parseFloat(product.grossWeightG ?? '0') * qty),
      referenceId: txn.id,
      notes: `Purchase ${txnNo}`,
      createdAt: txnDate,
    } as any);

    txnCount++;
  }

  // ─── REPAIRS (8 transactions) ─────────────────────────────────────────────
  const repairDescriptions = [
    { item: 'Gold Necklace',      issue: 'Clasp broken, chain links worn out', type: 'Clasp Replacement', charge: 450 },
    { item: 'Diamond Ring',       issue: 'Stone loose, prong worn',           type: 'Prong Tightening',   charge: 800 },
    { item: 'Silver Anklet',      issue: 'Ring links broken',                 type: 'Soldering',          charge: 250 },
    { item: 'Gold Bangle',        issue: 'Bangle cracked on one side',        type: 'Crack Repair',       charge: 600 },
    { item: 'Mangalsutra',        issue: 'Gold chain broken at middle',        type: 'Chain Joining',      charge: 350 },
    { item: 'Platinum Ring',      issue: 'Scratches, needs polishing',         type: 'Polishing',          charge: 1200 },
    { item: 'Gold Earring',       issue: 'Hook broken, backing missing',       type: 'Hook Replacement',   charge: 200 },
    { item: 'Diamond Bracelet',   issue: 'Clasp not locking properly',         type: 'Clasp Repair',       charge: 700 },
  ];

  const repairStatuses = ['received', 'in_progress', 'ready', 'completed', 'completed', 'completed'];

  for (let i = 0; i < repairDescriptions.length; i++) {
    const rd = repairDescriptions[i];
    const customer = pick(insertedCustomers);
    const txnDate = daysAgo(rand(2, 45));
    const txnNo = nextTxnNo();
    const rstatus = pick(repairStatuses);
    const txnStatus = rstatus === 'completed' ? 'completed' : rstatus === 'ready' ? 'in_progress' : 'pending';

    const [txn] = await db.insert(schema.transactions).values({
      transactionNo: txnNo,
      type: 'repair',
      status: txnStatus,
      customerId: customer.id,
      totalAmount: String(rd.charge),
      discountAmount: '0',
      taxAmount: '0',
      finalAmount: String(rd.charge),
      paymentMethod: rstatus === 'completed' ? pick(['cash', 'upi']) : null,
      paymentStatus: rstatus === 'completed' ? 'paid' : 'unpaid',
      amountPaid: rstatus === 'completed' ? String(rd.charge) : '0',
      notes: `Repair: ${rd.issue}`,
      transactionDate: txnDate,
      createdAt: txnDate,
      updatedAt: txnDate,
    } as any).returning();

    const estDays = rand(3, 10);
    const deliveryDate = new Date(txnDate);
    deliveryDate.setDate(deliveryDate.getDate() + estDays);

    await db.insert(schema.repairOrders).values({
      transactionId: txn.id,
      itemDescription: rd.item,
      issueDescribed: rd.issue,
      repairType: rd.type,
      estimatedDays: estDays,
      deliveryDate: deliveryDate.toISOString().split('T')[0],
      repairCharge: String(rd.charge),
      actualWeightG: String((rand(3, 25))),
      status: rstatus,
      technicianNotes: rstatus !== 'received' ? `Inspected. ${rd.type} required.` : null,
    } as any);

    txnCount++;
    repairCount++;
  }

  // ─── EXCHANGES (4 transactions) ───────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    const customer = pick(insertedCustomers);
    const newProduct = pick(insertedProducts.filter(p => p.metalType === 'gold'));
    const txnDate = daysAgo(rand(5, 40));
    const txnNo = nextTxnNo();
    const newPrice = productPrice(newProduct);
    const oldGoldWeight = rand(5, 15);
    const exchangeValue = oldGoldWeight * goldBase22 * 0.95; // 5% deduction
    const balance = Math.max(newPrice - exchangeValue, 0);

    const [txn] = await db.insert(schema.transactions).values({
      transactionNo: txnNo,
      type: 'exchange',
      status: 'completed',
      customerId: customer.id,
      totalAmount: String(newPrice),
      discountAmount: '0',
      taxAmount: '0',
      finalAmount: String(Math.round(balance)),
      paymentMethod: balance > 0 ? pick(['cash', 'upi']) : null,
      paymentStatus: 'paid',
      amountPaid: String(Math.round(balance)),
      notes: `Exchange: ${oldGoldWeight}g old gold jewelry against new piece`,
      goldRate: String(goldBase22),
      transactionDate: txnDate,
      createdAt: txnDate,
      updatedAt: txnDate,
    } as any).returning();

    // new item
    await db.insert(schema.transactionItems).values({
      transactionId: txn.id,
      productId: newProduct.id,
      productName: newProduct.name,
      quantity: 1,
      weightG: newProduct.grossWeightG,
      purity: newProduct.purity,
      ratePerGram: String(goldBase22),
      makingCharge: newProduct.makingCharge,
      stoneCharge: '0',
      unitPrice: String(newPrice),
      totalPrice: String(newPrice),
      isExchangeItem: false,
    });

    // exchange item (old jewelry coming in)
    await db.insert(schema.transactionItems).values({
      transactionId: txn.id,
      productId: null,
      productName: `Old Gold Jewelry (${oldGoldWeight}g)`,
      quantity: 1,
      weightG: String(oldGoldWeight),
      purity: '22k',
      ratePerGram: String(goldBase22 * 0.95),
      makingCharge: '0',
      stoneCharge: '0',
      unitPrice: String(Math.round(exchangeValue)),
      totalPrice: String(Math.round(exchangeValue)),
      isExchangeItem: true,
    });

    txnCount++;
  }

  console.log(`   ✓ ${txnCount} transactions (${saleDays.length} sales, 10 purchases, ${repairCount} repairs, 4 exchanges)`);
  console.log(`   ✓ ${invCount} invoices`);
  console.log(`   ✓ ${repairCount} repair orders`);

  // ── 8. Summary ─────────────────────────────────────────────────────────────
  console.log('\n✅ Dummy seed complete!\n');
  console.log('  Customers  :', insertedCustomers.length);
  console.log('  Products   :', insertedProducts.length);
  console.log('  Transactions:', txnCount);
  console.log('  Metal rates : 60 days of history');
  console.log('\n  Login: admin@jever.com / admin123\n');

  await pool.end();
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

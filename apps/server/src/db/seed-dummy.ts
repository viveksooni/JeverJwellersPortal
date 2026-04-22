/**
 * Dummy data seed — realistic jewelry shop data with proper categories,
 * picsum placeholder images, and structured SKUs.
 *
 * Only Gold and Silver products. Product names DO NOT include metal / purity —
 * those are stored in the metal/purity fields. Names are clean nouns like
 * "Chain", "Temple Ring", "Link Bracelet".
 *
 * Run: npx tsx src/db/seed-dummy.ts
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';
import { eq } from 'drizzle-orm';

// Gold = per_piece; Silver = template (bulk)
function resolveTracking(metalType: string): 'per_piece' | 'template' {
  return metalType === 'gold' ? 'per_piece' : 'template';
}

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

function picsumUrl(seed: string, w = 400, h = 400) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

let txnCounter = 1000;
let invCounter = 500;
function nextTxnNo() { return `TXN-${++txnCounter}`; }
function nextInvNo()  { return `INV-${++invCounter}`; }

const LOCATIONS = ['Showcase A', 'Showcase B', 'Showcase C', 'Safe', 'Display Window', 'Storage'];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Starting dummy data seed (Gold & Silver only)...\n');

  // ── 0. Clear existing data (safe order) ───────────────────────────────────
  console.log('🧹 Clearing existing product & category data...');
  await db.execute(sql`DELETE FROM invoices`);
  await db.execute(sql`DELETE FROM repair_orders`);
  await db.execute(sql`DELETE FROM transaction_items`);
  await db.execute(sql`DELETE FROM transactions`);
  await db.execute(sql`DELETE FROM inventory_movements`);
  await db.execute(sql`DELETE FROM inventory`);
  await db.execute(sql`DELETE FROM product_images`);
  await db.execute(sql`DELETE FROM pieces`);
  await db.execute(sql`DELETE FROM products`);
  await db.execute(sql`DELETE FROM categories`);
  await db.execute(sql`DELETE FROM metal_rates`);
  await db.execute(sql`ALTER SEQUENCE categories_id_seq RESTART WITH 1`);
  console.log('   ✓ Cleared\n');

  // ── 1. Metal rate history (last 60 days) — only gold 18/22/24 + silver + silver_925
  console.log('📈 Seeding metal rate history...');
  const goldBase22 = 6233;
  const silverBase = 85;
  const rateRows: any[] = [];
  for (let i = 60; i >= 0; i--) {
    const jitter = (n: number, pct: number) =>
      (n * (1 + (Math.random() - 0.5) * pct)).toFixed(2);
    const d = dateStr(i);
    const g22 = parseFloat(jitter(goldBase22, 0.04));
    const silverToday = parseFloat(jitter(silverBase, 0.05));
    rateRows.push(
      { metalType: 'gold_24k',   ratePerGram: (g22 * 24/22).toFixed(2), effectiveDate: d },
      { metalType: 'gold_22k',   ratePerGram: String(g22),               effectiveDate: d },
      { metalType: 'gold_18k',   ratePerGram: (g22 * 18/22).toFixed(2), effectiveDate: d },
      { metalType: 'silver',     ratePerGram: String(silverToday),       effectiveDate: d },
      { metalType: 'silver_925', ratePerGram: (silverToday * 0.925).toFixed(2), effectiveDate: d },
    );
  }
  for (const r of rateRows) {
    await db.insert(schema.metalRates).values(r).onConflictDoNothing();
  }
  console.log(`   ✓ ${rateRows.length} rate entries (5 metals × 61 days)`);

  // ── 2. Customers ──────────────────────────────────────────────────────────
  console.log('👥 Seeding customers...');
  const customerData = [
    { name: 'Rajesh Kumar',   phone: '9876543210', email: 'rajesh.kumar@gmail.com',      notes: 'Regular customer, prefers gold' },
    { name: 'Priya Sharma',   phone: '9865432109', email: 'priya.sharma@yahoo.com',      notes: 'Interested in bridal sets' },
    { name: 'Amit Verma',     phone: '9754321098', email: 'amit.verma@hotmail.com',      notes: '' },
    { name: 'Sunita Agarwal', phone: '9643210987', email: 'sunita.agarwal@gmail.com',    notes: 'Buying for daughter wedding' },
    { name: 'Deepak Mehta',   phone: '9532109876', email: 'deepak.mehta@gmail.com',      notes: '' },
    { name: 'Kavita Patel',   phone: '9421098765', email: 'kavita.patel@rediffmail.com', notes: 'Wholesale buyer' },
    { name: 'Suresh Nair',    phone: '9310987654', email: 'suresh.nair@gmail.com',       notes: 'Corporate gifting customer' },
    { name: 'Meena Joshi',    phone: '9209876543', email: 'meena.joshi@gmail.com',       notes: '' },
    { name: 'Ravi Shankar',   phone: '9098765432', email: 'ravi.shankar@gmail.com',      notes: 'Prefers silver jewelry' },
    { name: 'Anita Desai',    phone: '8987654321', email: 'anita.desai@gmail.com',       notes: 'Anniversary purchase yearly' },
    { name: 'Vikram Singh',   phone: '8876543210', email: 'vikram.singh@outlook.com',    notes: '' },
    { name: 'Pooja Kapoor',   phone: '8765432109', email: 'pooja.kapoor@gmail.com',      notes: 'Bridal set inquiry' },
    { name: 'Manoj Tiwari',   phone: '8654321098', email: 'manoj.tiwari@gmail.com',      notes: '' },
    { name: 'Nisha Gupta',    phone: '8543210987', email: 'nisha.gupta@gmail.com',       notes: 'Repair customer' },
    { name: 'Arun Saxena',    phone: '8432109876', email: 'arun.saxena@gmail.com',       notes: '' },
  ];
  const insertedCustomers = await db.insert(schema.customers).values(
    customerData.map(c => ({ ...c, createdAt: daysAgo(rand(5, 60)), updatedAt: new Date() }))
  ).returning();
  console.log(`   ✓ ${insertedCustomers.length} customers`);

  // ── 3. Categories ─────────────────────────────────────────────────────────
  console.log('🏷️  Seeding jewelry categories...');
  const categoryDefs = [
    { name: 'Ring',        description: 'Finger rings and bands',      skuPrefix: 'R',  trackingType: 'per_piece' },
    { name: 'Necklace',    description: 'Necklaces and haar',          skuPrefix: 'N',  trackingType: 'per_piece' },
    { name: 'Pendant',     description: 'Pendants and lockets',        skuPrefix: 'PD', trackingType: 'per_piece' },
    { name: 'Bracelet',    description: 'Bracelets and kangan',        skuPrefix: 'BR', trackingType: 'per_piece' },
    { name: 'Earring',     description: 'Earrings, studs and jhumkas', skuPrefix: 'E',  trackingType: 'per_piece' },
    { name: 'Bangle',      description: 'Bangles and kada',            skuPrefix: 'BG', trackingType: 'per_piece' },
    { name: 'Chain',       description: 'Chains and links',            skuPrefix: 'CH', trackingType: 'per_piece' },
    { name: 'Anklet',      description: 'Anklets and payals',          skuPrefix: 'AN', trackingType: 'template'  },
    { name: 'Mangalsutra', description: 'Mangalsutras',                skuPrefix: 'MS', trackingType: 'per_piece' },
    { name: 'Other',       description: 'Other jewelry items',         skuPrefix: 'OT', trackingType: 'template'  },
  ];
  const insertedCats = await db.insert(schema.categories).values(categoryDefs).returning();
  const catId = Object.fromEntries(insertedCats.map(c => [c.name, c.id]));
  console.log(`   ✓ ${insertedCats.length} categories`);

  // ── 4. Products with images ───────────────────────────────────────────────
  // SKU format: {MetalPrefix}{CategoryPrefix}-{NNN}
  // Metal prefix: G=Gold, S=Silver
  console.log('💍 Seeding products (clean names — no metal/purity in name)...');

  interface ProductDef {
    name: string; sku: string; categoryId: number; metalType: 'gold' | 'silver';
    purity: string; grossWeightG: string; netWeightG: string;
    makingCharge: string; makingType: 'flat' | 'per_gram' | 'percentage';
    description: string; images: string[];
  }

  const productDefs: ProductDef[] = [
    // ── Gold Rings (per_piece) ──────────────────────────────────────────────
    { name: 'Temple Ring', sku: 'GR-001',
      categoryId: catId['Ring'], metalType: 'gold', purity: '22K',
      grossWeightG: '4.500', netWeightG: '4.300',
      makingCharge: '12', makingType: 'per_gram',
      description: 'Traditional temple-style ring with intricate carving',
      images: ['gold-ring-1', 'gold-ring-1b'] },

    { name: 'Solitaire Band', sku: 'GR-002',
      categoryId: catId['Ring'], metalType: 'gold', purity: '18K',
      grossWeightG: '3.200', netWeightG: '3.100',
      makingCharge: '8', makingType: 'per_gram',
      description: 'Classic solitaire band — wedding favourite',
      images: ['gold-ring-2'] },

    { name: 'Antique Ring', sku: 'GR-003',
      categoryId: catId['Ring'], metalType: 'gold', purity: '22K',
      grossWeightG: '6.800', netWeightG: '6.500',
      makingCharge: '15', makingType: 'per_gram',
      description: 'Antique finish ring with traditional jali work',
      images: ['gold-ring-3', 'gold-ring-3b'] },

    { name: 'Engagement Ring', sku: 'GR-004',
      categoryId: catId['Ring'], metalType: 'gold', purity: '24K',
      grossWeightG: '5.000', netWeightG: '4.800',
      makingCharge: '1800', makingType: 'flat',
      description: 'Pure 24K engagement ring',
      images: ['gold-ring-4'] },

    // ── Gold Necklaces ─────────────────────────────────────────────────────
    { name: 'Rani Haar', sku: 'GN-001',
      categoryId: catId['Necklace'], metalType: 'gold', purity: '22K',
      grossWeightG: '38.500', netWeightG: '36.200',
      makingCharge: '18', makingType: 'per_gram',
      description: 'Royal rani haar with traditional motifs',
      images: ['gold-necklace-1', 'gold-necklace-1b'] },

    { name: 'Choker', sku: 'GN-002',
      categoryId: catId['Necklace'], metalType: 'gold', purity: '22K',
      grossWeightG: '24.000', netWeightG: '23.100',
      makingCharge: '16', makingType: 'per_gram',
      description: 'Wedding choker with fine filigree',
      images: ['gold-necklace-2'] },

    { name: 'Contemporary Chain Necklace', sku: 'GN-003',
      categoryId: catId['Necklace'], metalType: 'gold', purity: '18K',
      grossWeightG: '15.500', netWeightG: '15.000',
      makingCharge: '14', makingType: 'per_gram',
      description: 'Modern light-weight chain necklace',
      images: ['gold-necklace-3'] },

    // ── Gold Pendants ──────────────────────────────────────────────────────
    { name: 'Om Pendant', sku: 'GPD-001',
      categoryId: catId['Pendant'], metalType: 'gold', purity: '22K',
      grossWeightG: '2.500', netWeightG: '2.400',
      makingCharge: '400', makingType: 'flat',
      description: 'Sacred Om symbol pendant',
      images: ['gold-pendant-1'] },

    { name: 'Heart Pendant', sku: 'GPD-002',
      categoryId: catId['Pendant'], metalType: 'gold', purity: '18K',
      grossWeightG: '1.800', netWeightG: '1.700',
      makingCharge: '350', makingType: 'flat',
      description: 'Classic heart-shaped pendant',
      images: ['gold-pendant-2'] },

    // ── Gold Bracelets ─────────────────────────────────────────────────────
    { name: 'Link Bracelet', sku: 'GBR-001',
      categoryId: catId['Bracelet'], metalType: 'gold', purity: '22K',
      grossWeightG: '12.500', netWeightG: '12.100',
      makingCharge: '15', makingType: 'per_gram',
      description: 'Classic link bracelet for daily wear',
      images: ['gold-bracelet-1', 'gold-bracelet-1b'] },

    { name: 'Charm Bracelet', sku: 'GBR-002',
      categoryId: catId['Bracelet'], metalType: 'gold', purity: '18K',
      grossWeightG: '8.500', netWeightG: '8.200',
      makingCharge: '13', makingType: 'per_gram',
      description: 'Elegant charm bracelet',
      images: ['gold-bracelet-2'] },

    // ── Gold Earrings ──────────────────────────────────────────────────────
    { name: 'Jhumka', sku: 'GE-001',
      categoryId: catId['Earring'], metalType: 'gold', purity: '22K',
      grossWeightG: '8.200', netWeightG: '7.900',
      makingCharge: '14', makingType: 'per_gram',
      description: 'Traditional bell-shaped jhumka pair',
      images: ['gold-earring-1', 'gold-earring-1b'] },

    { name: 'Stud Earrings', sku: 'GE-002',
      categoryId: catId['Earring'], metalType: 'gold', purity: '18K',
      grossWeightG: '2.400', netWeightG: '2.300',
      makingCharge: '500', makingType: 'flat',
      description: 'Simple elegant studs for daily wear',
      images: ['gold-earring-2'] },

    { name: 'Chandbali', sku: 'GE-003',
      categoryId: catId['Earring'], metalType: 'gold', purity: '22K',
      grossWeightG: '9.500', netWeightG: '9.100',
      makingCharge: '16', makingType: 'per_gram',
      description: 'Crescent-shaped chandbali earrings',
      images: ['gold-earring-3'] },

    // ── Gold Bangles ───────────────────────────────────────────────────────
    { name: 'Plain Bangle Set', sku: 'GBG-001',
      categoryId: catId['Bangle'], metalType: 'gold', purity: '22K',
      grossWeightG: '28.000', netWeightG: '27.200',
      makingCharge: '10', makingType: 'per_gram',
      description: 'Pair of plain polished bangles',
      images: ['gold-bangle-1', 'gold-bangle-1b'] },

    { name: 'Kada', sku: 'GBG-002',
      categoryId: catId['Bangle'], metalType: 'gold', purity: '22K',
      grossWeightG: '22.500', netWeightG: '21.800',
      makingCharge: '14', makingType: 'per_gram',
      description: 'Broad kada with traditional engraving',
      images: ['gold-bangle-2'] },

    // ── Gold Chains ────────────────────────────────────────────────────────
    { name: 'Rope Chain', sku: 'GCH-001',
      categoryId: catId['Chain'], metalType: 'gold', purity: '22K',
      grossWeightG: '14.500', netWeightG: '14.200',
      makingCharge: '12', makingType: 'per_gram',
      description: 'Classic 20-inch rope chain',
      images: ['gold-chain-1'] },

    { name: 'Box Chain', sku: 'GCH-002',
      categoryId: catId['Chain'], metalType: 'gold', purity: '18K',
      grossWeightG: '9.800', netWeightG: '9.500',
      makingCharge: '10', makingType: 'per_gram',
      description: 'Thin box-link 18-inch chain',
      images: ['gold-chain-2'] },

    // ── Mangalsutra ────────────────────────────────────────────────────────
    { name: 'Traditional Mangalsutra', sku: 'GMS-001',
      categoryId: catId['Mangalsutra'], metalType: 'gold', purity: '22K',
      grossWeightG: '18.500', netWeightG: '17.800',
      makingCharge: '17', makingType: 'per_gram',
      description: 'Black bead mangalsutra with gold pendant',
      images: ['gold-ms-1'] },

    // ── Silver products (template / bulk) ───────────────────────────────────
    { name: 'Toe Ring', sku: 'SR-001',
      categoryId: catId['Ring'], metalType: 'silver', purity: '925',
      grossWeightG: '2.000', netWeightG: '1.900',
      makingCharge: '8', makingType: 'per_gram',
      description: 'Sterling silver toe ring',
      images: ['silver-ring-1'] },

    { name: 'Payal Anklet', sku: 'SAN-001',
      categoryId: catId['Anklet'], metalType: 'silver', purity: '925',
      grossWeightG: '32.000', netWeightG: '30.500',
      makingCharge: '12', makingType: 'per_gram',
      description: 'Sterling silver payal anklet pair with ghungroo',
      images: ['silver-anklet-1', 'silver-anklet-1b'] },

    { name: 'Fancy Anklet', sku: 'SAN-002',
      categoryId: catId['Anklet'], metalType: 'silver', purity: 'Silver',
      grossWeightG: '28.000', netWeightG: '26.500',
      makingCharge: '14', makingType: 'per_gram',
      description: 'Fancy design silver anklet pair',
      images: ['silver-anklet-2'] },

    { name: 'Oxidised Earrings', sku: 'SE-001',
      categoryId: catId['Earring'], metalType: 'silver', purity: '925',
      grossWeightG: '6.500', netWeightG: '6.200',
      makingCharge: '200', makingType: 'flat',
      description: 'Oxidised sterling silver earrings',
      images: ['silver-earring-1'] },

    { name: 'Beaded Necklace', sku: 'SN-001',
      categoryId: catId['Necklace'], metalType: 'silver', purity: '925',
      grossWeightG: '22.000', netWeightG: '21.200',
      makingCharge: '10', makingType: 'per_gram',
      description: 'Sterling silver beaded necklace',
      images: ['silver-necklace-1'] },

    { name: 'Chain Bracelet', sku: 'SBR-001',
      categoryId: catId['Bracelet'], metalType: 'silver', purity: 'Silver',
      grossWeightG: '14.500', netWeightG: '14.000',
      makingCharge: '150', makingType: 'flat',
      description: 'Silver chain-style bracelet',
      images: ['silver-bracelet-1'] },
  ];

  const insertedProducts: (typeof schema.products.$inferSelect)[] = [];
  for (const def of productDefs) {
    const { images, ...productData } = def;
    const trackingType = resolveTracking(productData.metalType);
    const [p] = await db.insert(schema.products).values({ ...productData as any, trackingType }).returning();
    insertedProducts.push(p);

    if (images.length > 0) {
      await db.insert(schema.productImages).values(
        images.map((seed, i) => ({
          productId: p.id,
          url: picsumUrl(seed),
          isPrimary: i === 0,
          sortOrder: i,
        }))
      );
    }
  }
  console.log(`   ✓ ${insertedProducts.length} products with images`);

  // ── 5. Inventory ──────────────────────────────────────────────────────────
  console.log('📦 Seeding inventory...');
  const inventoryData = insertedProducts.map((p) => ({
    productId: p.id,
    quantity: rand(3, 25),
    totalWeightG: (parseFloat(p.grossWeightG ?? '0') * rand(3, 25)).toFixed(4),
    minStockAlert: 2,
    location: pick(LOCATIONS),
    lastUpdated: new Date(),
  }));
  await db.insert(schema.inventory).values(inventoryData).onConflictDoNothing();
  console.log(`   ✓ ${inventoryData.length} inventory rows`);

  // ── 5b. Pieces for per-piece products (gold) ─────────────────────────────
  console.log('🏷️  Seeding individual pieces for gold products...');
  let totalPieces = 0;

  for (let pi = 0; pi < insertedProducts.length; pi++) {
    const p = insertedProducts[pi];
    if (p.trackingType !== 'per_piece') continue;

    const qty = inventoryData[pi].quantity;
    const baseWeight = parseFloat(p.grossWeightG ?? '4');
    const pieceRows = [];

    for (let i = 1; i <= qty; i++) {
      const variation = 1 + (Math.random() - 0.5) * 0.06;
      const gw = (baseWeight * variation).toFixed(4);
      const nw = (parseFloat(gw) * 0.93).toFixed(4);

      pieceRows.push({
        productId: p.id,
        tagNo: `${p.sku}-P${String(i).padStart(2, '0')}`,
        grossWeightG: gw,
        netWeightG: nw,
        purity: p.purity ?? undefined,
        status: 'in_stock' as const,
      });
    }

    await db.insert(schema.pieces).values(pieceRows);

    const totalW = pieceRows.reduce((s, r) => s + parseFloat(r.grossWeightG), 0);
    await db
      .update(schema.inventory)
      .set({ totalWeightG: totalW.toFixed(4), quantity: qty })
      .where(eq(schema.inventory.productId, p.id));

    totalPieces += qty;
  }
  console.log(`   ✓ ${totalPieces} individual pieces created`);

  // Opening stock movements
  const openingMovements = insertedProducts.map((p, i) => ({
    productId: p.id,
    movementType: 'adjustment',
    quantity: inventoryData[i].quantity,
    weightG: inventoryData[i].totalWeightG,
    notes: 'Opening stock',
    createdAt: daysAgo(rand(30, 60)),
  }));
  await db.insert(schema.inventoryMovements).values(openingMovements as any);

  // ── 6. Transactions ───────────────────────────────────────────────────────
  console.log('🧾 Seeding transactions...');

  function productPrice(p: typeof insertedProducts[0], g22Rate = 6233, sRate = 85): number {
    const gross = parseFloat(p.grossWeightG ?? '0');
    const making = parseFloat(p.makingCharge ?? '0');
    const mt = p.makingType ?? 'flat';
    let metal = 0;
    if (p.metalType === 'gold') {
      const rateMap: Record<string, number> = {
        '24K': g22Rate * (24/22), '22K': g22Rate, '18K': g22Rate * (18/22),
      };
      metal = gross * (rateMap[p.purity ?? '22K'] ?? g22Rate);
    } else if (p.metalType === 'silver') {
      metal = gross * (p.purity === '925' ? sRate * 0.925 : sRate);
    }
    const mc = mt === 'per_gram' ? making * gross : mt === 'percentage' ? metal * making / 100 : making;
    return Math.round(metal + mc);
  }

  let txnCount = 0; let invCount = 0; let repairCount = 0;

  // Sales (35)
  const saleDays = [1,1,2,3,3,4,5,6,6,7,8,9,10,11,12,12,14,15,16,17,18,20,21,22,24,25,27,28,30,33,35,38,42,50,58];
  for (const dBack of saleDays) {
    const customer = pick(insertedCustomers);
    const product = pick(insertedProducts);
    const qty = rand(1, 2);
    const g22 = goldBase22 * (1 + (Math.random()-0.5)*0.03);
    const unitPrice = productPrice(product, g22);
    const total = unitPrice * qty;
    const discount = rand(0,1) === 1 ? rand(100, 500) : 0;
    const finalAmt = Math.max(total - discount, total * 0.95);
    const txnNo = nextTxnNo();
    const txnDate = daysAgo(dBack);
    const payStatus = pick(['paid', 'paid', 'paid', 'partial'] as const);
    const payMethod = pick(['cash', 'upi', 'card', 'bank_transfer']);

    const [txn] = await db.insert(schema.transactions).values({
      transactionNo: txnNo, type: 'sale', status: 'completed',
      customerId: customer.id,
      totalAmount: String(total), discountAmount: String(discount), taxAmount: '0',
      finalAmount: String(Math.round(finalAmt)),
      paymentMethod: payMethod, paymentStatus: payStatus,
      amountPaid: payStatus === 'paid' ? String(Math.round(finalAmt)) : String(Math.round(finalAmt * 0.5)),
      goldRate: g22.toFixed(2),
      silverRate: (silverBase * (1+(Math.random()-0.5)*0.05)).toFixed(2),
      transactionDate: txnDate, createdAt: txnDate, updatedAt: txnDate,
    } as any).returning();

    await db.insert(schema.transactionItems).values({
      transactionId: txn.id, productId: product.id, productName: product.name,
      quantity: qty, weightG: String(parseFloat(product.grossWeightG ?? '0') * qty),
      purity: product.purity, ratePerGram: g22.toFixed(2), makingCharge: product.makingCharge,
      stoneCharge: '0', unitPrice: String(unitPrice), totalPrice: String(total), isExchangeItem: false,
    });

    await db.insert(schema.inventoryMovements).values({
      productId: product.id, movementType: 'sale', quantity: -qty,
      weightG: String(parseFloat(product.grossWeightG ?? '0') * qty),
      referenceId: txn.id, notes: `Sale ${txnNo}`, createdAt: txnDate,
    } as any);

    await db.insert(schema.invoices).values({
      invoiceNo: nextInvNo(), transactionId: txn.id, customerId: customer.id,
      pdfUrl: null, whatsappSent: rand(0,1) === 1, gstEnabled: false, issuedAt: txnDate,
    } as any);

    txnCount++; invCount++;
  }

  // Purchases (10)
  for (let i = 0; i < 10; i++) {
    const product = pick(insertedProducts);
    const qty = rand(3, 8);
    const unitPrice = Math.round(productPrice(product) * 0.9);
    const total = unitPrice * qty;
    const txnNo = nextTxnNo();
    const txnDate = daysAgo(rand(5, 55));

    const [txn] = await db.insert(schema.transactions).values({
      transactionNo: txnNo, type: 'purchase', status: 'completed',
      customerId: null,
      totalAmount: String(total), discountAmount: '0', taxAmount: '0', finalAmount: String(total),
      paymentMethod: pick(['cash', 'bank_transfer', 'cheque']),
      paymentStatus: 'paid', amountPaid: String(total),
      notes: 'Stock purchase from vendor',
      goldRate: String(goldBase22), silverRate: String(silverBase),
      transactionDate: txnDate, createdAt: txnDate, updatedAt: txnDate,
    } as any).returning();

    await db.insert(schema.transactionItems).values({
      transactionId: txn.id, productId: product.id, productName: product.name,
      quantity: qty, weightG: String(parseFloat(product.grossWeightG ?? '0') * qty),
      purity: product.purity, ratePerGram: String(goldBase22), makingCharge: product.makingCharge,
      stoneCharge: '0', unitPrice: String(unitPrice), totalPrice: String(total), isExchangeItem: false,
    });

    await db.insert(schema.inventoryMovements).values({
      productId: product.id, movementType: 'purchase', quantity: qty,
      weightG: String(parseFloat(product.grossWeightG ?? '0') * qty),
      referenceId: txn.id, notes: `Purchase ${txnNo}`, createdAt: txnDate,
    } as any);

    txnCount++;
  }

  // Repairs (6) — only gold & silver items
  const repairDescriptions = [
    { item: 'Gold Necklace',  issue: 'Clasp broken',        type: 'Clasp Replacement', charge: 450 },
    { item: 'Silver Anklet',  issue: 'Links broken',        type: 'Soldering',         charge: 250 },
    { item: 'Gold Bangle',    issue: 'Cracked on one side', type: 'Crack Repair',      charge: 600 },
    { item: 'Mangalsutra',    issue: 'Chain broken',        type: 'Chain Joining',     charge: 350 },
    { item: 'Gold Earring',   issue: 'Hook broken',         type: 'Hook Replacement',  charge: 200 },
    { item: 'Silver Ring',    issue: 'Needs polishing',     type: 'Polishing',         charge: 150 },
  ];
  const repairStatuses = ['received', 'in_progress', 'ready', 'completed', 'completed', 'completed'];

  for (const rd of repairDescriptions) {
    const customer = pick(insertedCustomers);
    const txnDate = daysAgo(rand(2, 45));
    const txnNo = nextTxnNo();
    const rstatus = pick(repairStatuses);
    const txnStatus = rstatus === 'completed' ? 'completed' : rstatus === 'ready' ? 'in_progress' : 'pending';

    const [txn] = await db.insert(schema.transactions).values({
      transactionNo: txnNo, type: 'repair', status: txnStatus,
      customerId: customer.id,
      totalAmount: String(rd.charge), discountAmount: '0', taxAmount: '0', finalAmount: String(rd.charge),
      paymentMethod: rstatus === 'completed' ? pick(['cash', 'upi']) : null,
      paymentStatus: rstatus === 'completed' ? 'paid' : 'unpaid',
      amountPaid: rstatus === 'completed' ? String(rd.charge) : '0',
      notes: `Repair: ${rd.issue}`,
      transactionDate: txnDate, createdAt: txnDate, updatedAt: txnDate,
    } as any).returning();

    const estDays = rand(3, 10);
    const delivDate = new Date(txnDate);
    delivDate.setDate(delivDate.getDate() + estDays);

    await db.insert(schema.repairOrders).values({
      transactionId: txn.id, itemDescription: rd.item, issueDescribed: rd.issue,
      repairType: rd.type, estimatedDays: estDays,
      deliveryDate: delivDate.toISOString().split('T')[0],
      repairCharge: String(rd.charge), actualWeightG: String(rand(3, 25)),
      status: rstatus,
      technicianNotes: rstatus !== 'received' ? `Inspected. ${rd.type} required.` : null,
    } as any);

    txnCount++; repairCount++;
  }

  // Exchanges (4) — only gold items
  const goldProducts = insertedProducts.filter(p => p.metalType === 'gold');
  for (let i = 0; i < 4; i++) {
    const customer = pick(insertedCustomers);
    const newProduct = pick(goldProducts);
    const txnDate = daysAgo(rand(5, 40));
    const txnNo = nextTxnNo();
    const newPrice = productPrice(newProduct);
    const oldGoldWeight = rand(5, 15);
    const exchangeValue = oldGoldWeight * goldBase22 * 0.95;
    const balance = Math.max(newPrice - exchangeValue, 0);

    const [txn] = await db.insert(schema.transactions).values({
      transactionNo: txnNo, type: 'exchange', status: 'completed',
      customerId: customer.id,
      totalAmount: String(newPrice), discountAmount: '0', taxAmount: '0',
      finalAmount: String(Math.round(balance)),
      paymentMethod: balance > 0 ? pick(['cash', 'upi']) : null,
      paymentStatus: 'paid', amountPaid: String(Math.round(balance)),
      notes: `Exchange: ${oldGoldWeight}g old gold against new piece`,
      goldRate: String(goldBase22),
      transactionDate: txnDate, createdAt: txnDate, updatedAt: txnDate,
    } as any).returning();

    await db.insert(schema.transactionItems).values({
      transactionId: txn.id, productId: newProduct.id, productName: newProduct.name,
      quantity: 1, weightG: newProduct.grossWeightG, purity: newProduct.purity,
      ratePerGram: String(goldBase22), makingCharge: newProduct.makingCharge,
      stoneCharge: '0', unitPrice: String(newPrice), totalPrice: String(newPrice), isExchangeItem: false,
    });

    await db.insert(schema.transactionItems).values({
      transactionId: txn.id, productId: null,
      productName: `Old Gold Jewelry (${oldGoldWeight}g)`,
      quantity: 1, weightG: String(oldGoldWeight), purity: '22K',
      ratePerGram: String(goldBase22 * 0.95), makingCharge: '0',
      stoneCharge: '0', unitPrice: String(Math.round(exchangeValue)),
      totalPrice: String(Math.round(exchangeValue)), isExchangeItem: true,
    });

    txnCount++;
  }

  console.log(`   ✓ ${txnCount} transactions (${saleDays.length} sales, 10 purchases, ${repairCount} repairs, 4 exchanges)`);
  console.log(`   ✓ ${invCount} invoices`);

  console.log('\n✅ Dummy seed complete!\n');
  console.log('  Customers   :', insertedCustomers.length);
  console.log('  Categories  :', insertedCats.length);
  console.log('  Products    :', insertedProducts.length, '(Gold + Silver only, clean names)');
  console.log('  Transactions:', txnCount);
  console.log('  Metal rates : 60 days of history (gold 18/22/24K, silver, silver 925)');
  console.log('\n  Login: admin@jever.com / admin123\n');

  await pool.end();
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

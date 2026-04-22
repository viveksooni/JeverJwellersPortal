import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import * as schema from './schema.js';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

async function main() {
  console.log('Seeding database...');

  // ── Clear existing product/inventory/customer/rate data ──────────────────────
  // Keeps users and shop_settings intact.
  await db.execute(sql`
    TRUNCATE
      inventory_movements,
      repair_orders,
      invoices,
      transaction_items,
      transactions,
      pieces,
      inventory,
      product_images,
      products,
      customers,
      metal_rates,
      categories
    RESTART IDENTITY CASCADE
  `);

  // ── Categories ───────────────────────────────────────────────────────────────
  await db.insert(schema.categories).values([
    { name: 'Ring',     skuPrefix: 'R',  description: 'Finger rings and bands',     trackingType: 'per_piece' },
    { name: 'Necklace', skuPrefix: 'N',  description: 'Necklaces',                  trackingType: 'per_piece' },
    { name: 'Locket',   skuPrefix: 'L',  description: 'Lockets and pendants',       trackingType: 'per_piece' },
    { name: 'Bracelet', skuPrefix: 'BR', description: 'Bracelets',                  trackingType: 'per_piece' },
    { name: 'Earring',  skuPrefix: 'ER', description: 'Earrings and ear studs',     trackingType: 'per_piece' },
    { name: 'Bangle',   skuPrefix: 'BN', description: 'Traditional bangles',        trackingType: 'template'  },
    { name: 'Chain',    skuPrefix: 'CH', description: 'Chains and links',           trackingType: 'template'  },
    { name: 'Pendant',  skuPrefix: 'PD', description: 'Pendants and charms',        trackingType: 'per_piece' },
    { name: 'Anklet',   skuPrefix: 'AK', description: 'Anklets and foot jewelry',   trackingType: 'per_piece' },
    { name: 'Other',    skuPrefix: 'OT', description: 'Other jewelry items',        trackingType: 'template'  },
  ]);

  // ── Admin user ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 12);
  await db.insert(schema.users).values({
    name: 'Shop Admin',
    email: 'admin@jever.com',
    passwordHash,
    role: 'admin',
  }).onConflictDoNothing();

  // ── Shop settings ────────────────────────────────────────────────────────────
  const defaultSettings = [
    { key: 'shop_name',          value: 'Jever Jwellers' },
    { key: 'shop_address',       value: 'Main Market, Sector 15, Noida - 201301' },
    { key: 'shop_phone',         value: '+91 98765 43210' },
    { key: 'shop_email',         value: 'info@jeverjwellers.com' },
    { key: 'shop_gstin',         value: '' },
    { key: 'gst_enabled',        value: 'false' },
    { key: 'cgst_rate',          value: '1.5' },
    { key: 'sgst_rate',          value: '1.5' },
    { key: 'invoice_prefix',     value: 'INV' },
    { key: 'transaction_prefix', value: 'TXN' },
    { key: 'logo_url',           value: '' },
    { key: 'shop_bank_account',  value: '' },
    { key: 'shop_bank_name',     value: '' },
    { key: 'shop_bank_branch',   value: '' },
    { key: 'shop_bank_ifsc',     value: '' },
    { key: 'shop_terms',         value: '1- Gold rate applicable as per association rate (18K/22K)\n2- 100% exchange & 95% cash back on gold jewellery\n3- 80% exchange & 80% cashback on silver jewellery\n4- Meena, stone & dust are deducted in case of return/exchange\n5- All disputes are subject to local jurisdiction only' },
  ];
  for (const s of defaultSettings) {
    await db.insert(schema.shopSettings).values(s).onConflictDoNothing();
  }

  // ── Metal rates (April 2025 approximate Indian market) ───────────────────────
  const today = new Date().toISOString().split('T')[0];
  await db.insert(schema.metalRates).values([
    { metalType: 'gold_24k', ratePerGram: '9450.00', effectiveDate: today },
    { metalType: 'gold_22k', ratePerGram: '8663.00', effectiveDate: today },
    { metalType: 'gold_18k', ratePerGram: '7088.00', effectiveDate: today },
    { metalType: 'silver',     ratePerGram: '108.00', effectiveDate: today },
    { metalType: 'silver_925', ratePerGram: '99.00',  effectiveDate: today },
  ]);

  // ── Sample customers ─────────────────────────────────────────────────────────
  await db.insert(schema.customers).values([
    { name: 'Priya Sharma',    phone: '9876543210', email: 'priya.sharma@gmail.com', address: 'Sector 12, Noida' },
    { name: 'Rahul Verma',     phone: '9812345678', address: 'MG Road, Gurgaon' },
    { name: 'Anita Singh',     phone: '9898765432', address: 'Lajpat Nagar, Delhi' },
    { name: 'Mohit Gupta',     phone: '9765432100' },
    { name: 'Sunita Agarwal',  phone: '9654321098', address: 'Civil Lines, Jaipur' },
    { name: 'Deepak Joshi',    phone: '9543210987', address: 'Hazratganj, Lucknow' },
    { name: 'Kavita Mehta',    phone: '9432109876', email: 'kavita.mehta@yahoo.com', address: 'FC Road, Pune' },
    { name: 'Suresh Yadav',    phone: '9321098765' },
  ]);

  // ── Sample products + inventory ──────────────────────────────────────────────
  // Category IDs after RESTART IDENTITY: Ring=1, Necklace=2, Locket=3, Bracelet=4,
  // Earring=5, Bangle=6, Chain=7, Pendant=8, Anklet=9, Other=10

  const productsToInsert = [
    // Gold per-piece items
    {
      categoryId: 1, name: 'Gold Ring Classic',        sku: 'GR-001', metalType: 'gold', purity: '22K',
      grossWeightG: '5.800', netWeightG: '5.200', makingCharge: '18', makingType: 'percentage',
      trackingType: 'per_piece', description: 'Classic plain gold ring',
    },
    {
      categoryId: 1, name: 'Gold Ring Floral',         sku: 'GR-002', metalType: 'gold', purity: '22K',
      grossWeightG: '7.200', netWeightG: '6.500', makingCharge: '20', makingType: 'percentage',
      trackingType: 'per_piece', description: 'Floral design ladies ring',
    },
    {
      categoryId: 2, name: 'Gold Necklace Set',        sku: 'GN-001', metalType: 'gold', purity: '22K',
      grossWeightG: '28.500', netWeightG: '26.000', makingCharge: '22', makingType: 'percentage',
      trackingType: 'per_piece', description: 'Traditional bridal necklace set',
    },
    {
      categoryId: 3, name: 'Gold Locket Ganesh',       sku: 'GL-001', metalType: 'gold', purity: '22K',
      grossWeightG: '4.100', netWeightG: '3.800', makingCharge: '350', makingType: 'flat',
      trackingType: 'per_piece', description: 'Ganesh ji gold locket',
    },
    {
      categoryId: 4, name: 'Gold Bracelet Ladies',     sku: 'GBR-001', metalType: 'gold', purity: '22K',
      grossWeightG: '12.000', netWeightG: '11.200', makingCharge: '19', makingType: 'percentage',
      trackingType: 'per_piece', description: 'Ladies gold bracelet',
    },
    {
      categoryId: 5, name: 'Gold Earring Studs',       sku: 'GER-001', metalType: 'gold', purity: '22K',
      grossWeightG: '3.200', netWeightG: '2.900', makingCharge: '280', makingType: 'flat',
      trackingType: 'per_piece', description: 'Classic gold stud earrings',
    },
    {
      categoryId: 5, name: 'Gold Earring Jhumka',      sku: 'GER-002', metalType: 'gold', purity: '22K',
      grossWeightG: '8.500', netWeightG: '7.800', makingCharge: '600', makingType: 'flat',
      trackingType: 'per_piece', description: 'Traditional gold jhumka earrings',
    },
    {
      categoryId: 8, name: 'Gold Pendant Om',          sku: 'GPD-001', metalType: 'gold', purity: '22K',
      grossWeightG: '2.800', netWeightG: '2.600', makingCharge: '220', makingType: 'flat',
      trackingType: 'per_piece', description: 'Om symbol gold pendant',
    },
    {
      categoryId: 9, name: 'Gold Anklet Pair',         sku: 'GAK-001', metalType: 'gold', purity: '18K',
      grossWeightG: '9.500', netWeightG: '8.800', makingCharge: '15', makingType: 'percentage',
      trackingType: 'per_piece', description: 'Ladies gold anklet pair',
    },
    // Silver bulk/template items
    {
      categoryId: 7, name: 'Silver Chain 925',         sku: 'SCH-001', metalType: 'silver', purity: '925',
      grossWeightG: '15.000', netWeightG: '15.000', makingCharge: '45', makingType: 'per_gram',
      trackingType: 'template', description: '925 silver link chain',
    },
    {
      categoryId: 6, name: 'Silver Bangle Set',        sku: 'SBN-001', metalType: 'silver', purity: 'Silver',
      grossWeightG: '45.000', netWeightG: '45.000', makingCharge: '35', makingType: 'per_gram',
      trackingType: 'template', description: 'Traditional silver bangle set of 4',
    },
    {
      categoryId: 7, name: 'Silver Chain Plain',       sku: 'SCH-002', metalType: 'silver', purity: 'Silver',
      grossWeightG: '10.000', netWeightG: '10.000', makingCharge: '40', makingType: 'per_gram',
      trackingType: 'template', description: 'Plain silver chain',
    },
  ];

  const insertedProducts = await db.insert(schema.products).values(
    productsToInsert.map((p) => ({ ...p }))
  ).returning({ id: schema.products.id });

  // Inventory data aligned with product order above
  const inventoryData = [
    { quantity: 5,  minStockAlert: 2, location: 'Showcase A' },  // GR-001
    { quantity: 3,  minStockAlert: 1, location: 'Showcase A' },  // GR-002
    { quantity: 2,  minStockAlert: 1, location: 'Showcase B' },  // GN-001
    { quantity: 8,  minStockAlert: 3, location: 'Showcase A' },  // GL-001
    { quantity: 4,  minStockAlert: 2, location: 'Showcase B' },  // GBR-001
    { quantity: 6,  minStockAlert: 2, location: 'Showcase A' },  // GER-001
    { quantity: 3,  minStockAlert: 1, location: 'Showcase B' },  // GER-002
    { quantity: 10, minStockAlert: 3, location: 'Showcase A' },  // GPD-001
    { quantity: 2,  minStockAlert: 1, location: 'Safe' },        // GAK-001
    { quantity: 15, minStockAlert: 5, location: 'Storage' },     // SCH-001
    { quantity: 20, minStockAlert: 5, location: 'Storage' },     // SBN-001
    { quantity: 12, minStockAlert: 4, location: 'Storage' },     // SCH-002
  ];

  await db.insert(schema.inventory).values(
    insertedProducts.map((p, i) => ({
      productId: p.id,
      quantity: inventoryData[i].quantity,
      minStockAlert: inventoryData[i].minStockAlert,
      location: inventoryData[i].location,
      totalWeightG: '0',
    }))
  );

  console.log('Seeding complete!');
  console.log('Admin login: admin@jever.com / admin123');
  console.log(`Inserted ${insertedProducts.length} products with inventory`);
  await pool.end();
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

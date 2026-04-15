import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import * as schema from './schema.js';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

async function main() {
  console.log('Seeding database...');

  // Seed categories
  await db.insert(schema.categories).values([
    { name: 'Gold', description: 'Gold jewelry items' },
    { name: 'Silver', description: 'Silver jewelry items' },
    { name: 'Diamond', description: 'Diamond jewelry items' },
    { name: 'Platinum', description: 'Platinum jewelry items' },
    { name: 'Other', description: 'Other jewelry items' },
  ]).onConflictDoNothing();

  // Seed admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  await db.insert(schema.users).values({
    name: 'Shop Admin',
    email: 'admin@jever.com',
    passwordHash,
    role: 'admin',
  }).onConflictDoNothing();

  // Seed shop settings
  const defaultSettings = [
    { key: 'shop_name', value: 'Jever Jwellers' },
    { key: 'shop_address', value: '' },
    { key: 'shop_phone', value: '' },
    { key: 'shop_email', value: '' },
    { key: 'shop_gstin', value: '' },
    { key: 'gst_enabled', value: 'false' },
    { key: 'cgst_rate', value: '1.5' },
    { key: 'sgst_rate', value: '1.5' },
    { key: 'invoice_prefix', value: 'INV' },
    { key: 'transaction_prefix', value: 'TXN' },
    { key: 'logo_url', value: '' },
  ];
  for (const s of defaultSettings) {
    await db.insert(schema.shopSettings).values(s).onConflictDoNothing();
  }

  // Seed today's metal rates (sample)
  const today = new Date().toISOString().split('T')[0];
  await db.insert(schema.metalRates).values([
    { metalType: 'gold_24k', ratePerGram: '6800.00', effectiveDate: today },
    { metalType: 'gold_22k', ratePerGram: '6233.00', effectiveDate: today },
    { metalType: 'gold_18k', ratePerGram: '5100.00', effectiveDate: today },
    { metalType: 'gold_14k', ratePerGram: '3978.00', effectiveDate: today },
    { metalType: 'silver_999', ratePerGram: '85.00', effectiveDate: today },
    { metalType: 'silver_925', ratePerGram: '79.00', effectiveDate: today },
    { metalType: 'platinum_950', ratePerGram: '3200.00', effectiveDate: today },
  ]).onConflictDoNothing();

  console.log('Seeding complete!');
  console.log('Admin login: admin@jever.com / admin123');
  await pool.end();
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

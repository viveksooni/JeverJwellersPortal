/**
 * Run this script once to replace the old metal-based categories
 * (Gold, Silver, Diamond…) with proper jewelry-type categories
 * (Ring, Necklace, Locket, etc.).
 *
 * Usage:  npx tsx src/db/fix-categories.ts
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

const JEWELRY_CATEGORIES = [
  { name: 'Ring',        description: 'Finger rings and bands',      skuPrefix: 'R'  },
  { name: 'Necklace',    description: 'Necklaces and haar',          skuPrefix: 'N'  },
  { name: 'Locket',      description: 'Lockets and pendants',        skuPrefix: 'L'  },
  { name: 'Bracelet',    description: 'Bracelets and kangan',        skuPrefix: 'BR' },
  { name: 'Earring',     description: 'Earrings, studs and jhumkas', skuPrefix: 'E'  },
  { name: 'Bangle',      description: 'Bangles and kada',            skuPrefix: 'BG' },
  { name: 'Chain',       description: 'Chains and links',            skuPrefix: 'CH' },
  { name: 'Pendant',     description: 'Pendants and charms',         skuPrefix: 'PD' },
  { name: 'Anklet',      description: 'Anklets and payals',          skuPrefix: 'AN' },
  { name: 'Mangalsutra', description: 'Mangalsutras',                skuPrefix: 'MS' },
  { name: 'Other',       description: 'Other jewelry items',         skuPrefix: 'OT' },
];

async function main() {
  console.log('Fixing categories…');

  // Nullify categoryId on all products so FK constraint doesn't block delete
  await db.execute(sql`UPDATE products SET category_id = NULL`);
  console.log('  ✓ Cleared product category references');

  // Remove old metal-based categories
  await db.execute(sql`DELETE FROM categories`);
  console.log('  ✓ Removed old categories');

  // Reset serial so IDs start from 1
  await db.execute(sql`ALTER SEQUENCE categories_id_seq RESTART WITH 1`);

  // Insert new jewelry-type categories
  await db.insert(schema.categories).values(JEWELRY_CATEGORIES);
  console.log('  ✓ Inserted jewelry-type categories');

  console.log('\nDone! New categories:');
  JEWELRY_CATEGORIES.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}`));
  console.log('\nNote: All products have been unlinked from categories.');
  console.log('Please reassign them via the Products page.');

  await pool.end();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});

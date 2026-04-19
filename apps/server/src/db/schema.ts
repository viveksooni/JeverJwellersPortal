import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  serial,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).default('admin').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 150 }),
  address: text('address'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  skuPrefix: varchar('sku_prefix', { length: 10 }),
  trackingType: varchar('tracking_type', { length: 20 }).default('template').notNull(),
  // 'template' = quantity only; 'per_piece' = each physical piece tracked individually
});

// ─── Products ─────────────────────────────────────────────────────────────────

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: integer('category_id').references(() => categories.id),
  name: varchar('name', { length: 200 }).notNull(),
  sku: varchar('sku', { length: 100 }).unique(),
  description: text('description'),
  metalType: varchar('metal_type', { length: 50 }),
  purity: varchar('purity', { length: 20 }),
  grossWeightG: numeric('gross_weight_g', { precision: 10, scale: 4 }),
  netWeightG: numeric('net_weight_g', { precision: 10, scale: 4 }),
  stoneType: varchar('stone_type', { length: 100 }),
  stoneWeightCt: numeric('stone_weight_ct', { precision: 10, scale: 4 }),
  makingCharge: numeric('making_charge', { precision: 10, scale: 2 }),
  makingType: varchar('making_type', { length: 20 }).default('flat').notNull(),
  trackingType: varchar('tracking_type', { length: 20 }).default('template').notNull(),
  // inherits from category default; 'per_piece' for gold/diamond, 'template' for silver/others
  isActive: boolean('is_active').default(true).notNull(),
  attributes: jsonb('attributes').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Product Images ───────────────────────────────────────────────────────────

export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  url: text('url').notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  quantity: integer('quantity').default(0).notNull(),
  totalWeightG: numeric('total_weight_g', { precision: 12, scale: 4 }).default('0').notNull(),
  minStockAlert: integer('min_stock_alert').default(1).notNull(),
  location: varchar('location', { length: 100 }),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Inventory Movements ──────────────────────────────────────────────────────

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').references(() => products.id).notNull(),
    movementType: varchar('movement_type', { length: 30 }).notNull(),
    quantity: integer('quantity').notNull(),
    weightG: numeric('weight_g', { precision: 10, scale: 4 }),
    referenceId: uuid('reference_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (table) => [index('idx_inv_mov_product').on(table.productId)],
);

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionNo: varchar('transaction_no', { length: 50 }).notNull().unique(),
    type: varchar('type', { length: 30 }).notNull(),
    status: varchar('status', { length: 30 }).default('pending').notNull(),
    customerId: uuid('customer_id').references(() => customers.id),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    finalAmount: numeric('final_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    paymentMethod: varchar('payment_method', { length: 30 }),
    paymentStatus: varchar('payment_status', { length: 20 }).default('unpaid').notNull(),
    amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0').notNull(),
    notes: text('notes'),
    goldRate: numeric('gold_rate', { precision: 10, scale: 2 }),
    silverRate: numeric('silver_rate', { precision: 10, scale: 2 }),
    transactionDate: timestamp('transaction_date', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (table) => [
    index('idx_txn_date').on(table.transactionDate),
    index('idx_txn_type').on(table.type),
    index('idx_txn_customer').on(table.customerId),
  ],
);

// ─── Transaction Items ────────────────────────────────────────────────────────

export const transactionItems = pgTable('transaction_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id')
    .references(() => transactions.id, { onDelete: 'cascade' })
    .notNull(),
  productId: uuid('product_id').references(() => products.id),
  productName: varchar('product_name', { length: 200 }).notNull(),
  quantity: integer('quantity').default(1).notNull(),
  weightG: numeric('weight_g', { precision: 10, scale: 4 }),
  purity: varchar('purity', { length: 20 }),
  ratePerGram: numeric('rate_per_gram', { precision: 10, scale: 2 }),
  makingCharge: numeric('making_charge', { precision: 10, scale: 2 }),
  stoneCharge: numeric('stone_charge', { precision: 10, scale: 2 }).default('0').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
  isExchangeItem: boolean('is_exchange_item').default(false).notNull(),
  pieceId: uuid('piece_id'), // filled when selling a per-piece tracked item
});

// ─── Repair Orders ────────────────────────────────────────────────────────────

export const repairOrders = pgTable('repair_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id')
    .references(() => transactions.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  itemDescription: text('item_description').notNull(),
  issueDescribed: text('issue_described'),
  repairType: varchar('repair_type', { length: 100 }),
  estimatedDays: integer('estimated_days'),
  deliveryDate: date('delivery_date'),
  repairCharge: numeric('repair_charge', { precision: 10, scale: 2 }),
  actualWeightG: numeric('actual_weight_g', { precision: 10, scale: 4 }),
  status: varchar('status', { length: 30 }).default('received').notNull(),
  technicianNotes: text('technician_notes'),
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNo: varchar('invoice_no', { length: 50 }).notNull().unique(),
  transactionId: uuid('transaction_id').references(() => transactions.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  pdfUrl: text('pdf_url'),
  whatsappSent: boolean('whatsapp_sent').default(false).notNull(),
  whatsappSentAt: timestamp('whatsapp_sent_at', { withTimezone: true }),
  gstEnabled: boolean('gst_enabled').default(false).notNull(),
  gstin: varchar('gstin', { length: 20 }),
  cgstRate: numeric('cgst_rate', { precision: 5, scale: 2 }),
  sgstRate: numeric('sgst_rate', { precision: 5, scale: 2 }),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});

// ─── Metal Rates ──────────────────────────────────────────────────────────────

export const metalRates = pgTable(
  'metal_rates',
  {
    id: serial('id').primaryKey(),
    metalType: varchar('metal_type', { length: 20 }).notNull(),
    ratePerGram: numeric('rate_per_gram', { precision: 10, scale: 2 }).notNull(),
    effectiveDate: date('effective_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('uniq_rate_type_date').on(table.metalType, table.effectiveDate)],
);

// ─── Day Remarks (for analytics heatmap notes) ───────────────────────────────

export const dayRemarks = pgTable('day_remarks', {
  id: serial('id').primaryKey(),
  date: date('date').notNull().unique(),
  remark: text('remark').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Shop Settings ────────────────────────────────────────────────────────────

export const shopSettings = pgTable('shop_settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Pieces (per-piece tracking for gold/diamond) ─────────────────────────────
// Each physical piece of jewelry gets its own row when trackingType = 'per_piece'

export const pieces = pgTable(
  'pieces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    tagNo: varchar('tag_no', { length: 50 }).unique(), // physical tag attached to piece
    grossWeightG: numeric('gross_weight_g', { precision: 10, scale: 4 }),
    netWeightG: numeric('net_weight_g', { precision: 10, scale: 4 }),
    stoneWeightCt: numeric('stone_weight_ct', { precision: 10, scale: 4 }),
    purity: varchar('purity', { length: 20 }), // can differ from product template
    status: varchar('status', { length: 20 }).default('in_stock').notNull(),
    // status: in_stock | sold | on_repair | on_hold
    notes: text('notes'),
    soldTransactionId: uuid('sold_transaction_id').references(() => transactions.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_pieces_product').on(table.productId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  inventory: one(inventory, { fields: [products.id], references: [inventory.productId] }),
  pieces: many(pieces),
}));

export const piecesRelations = relations(pieces, ({ one }) => ({
  product: one(products, { fields: [pieces.productId], references: [products.id] }),
  soldTransaction: one(transactions, { fields: [pieces.soldTransactionId], references: [transactions.id] }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, { fields: [inventory.productId], references: [products.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  customer: one(customers, { fields: [transactions.customerId], references: [customers.id] }),
  items: many(transactionItems),
  repairOrder: one(repairOrders, {
    fields: [transactions.id],
    references: [repairOrders.transactionId],
  }),
  invoice: one(invoices, {
    fields: [transactions.id],
    references: [invoices.transactionId],
  }),
}));

export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  product: one(products, { fields: [transactionItems.productId], references: [products.id] }),
}));

export const repairOrdersRelations = relations(repairOrders, ({ one }) => ({
  transaction: one(transactions, {
    fields: [repairOrders.transactionId],
    references: [transactions.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  transaction: one(transactions, {
    fields: [invoices.transactionId],
    references: [transactions.id],
  }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  transactions: many(transactions),
  invoices: many(invoices),
}));

// ─── Types (inferred from schema) ────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type NewTransactionItem = typeof transactionItems.$inferInsert;
export type RepairOrder = typeof repairOrders.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type MetalRate = typeof metalRates.$inferSelect;
export type ShopSetting = typeof shopSettings.$inferSelect;
export type DayRemark = typeof dayRemarks.$inferSelect;
export type Piece = typeof pieces.$inferSelect;
export type NewPiece = typeof pieces.$inferInsert;

-- Per-piece tracking support

-- Add tracking_type to categories (template = qty only, per_piece = individual pieces)
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "tracking_type" varchar(20) NOT NULL DEFAULT 'template';

-- Add tracking_type to products (inherits from category, overridable per product)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tracking_type" varchar(20) NOT NULL DEFAULT 'template';

-- Add piece_id to transaction_items (links sale item to specific physical piece)
ALTER TABLE "transaction_items" ADD COLUMN IF NOT EXISTS "piece_id" uuid;

-- Pieces table: one row per physical piece of jewelry
CREATE TABLE IF NOT EXISTS "pieces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "tag_no" varchar(50) UNIQUE,
  "gross_weight_g" numeric(10, 4),
  "net_weight_g" numeric(10, 4),
  "stone_weight_ct" numeric(10, 4),
  "purity" varchar(20),
  "status" varchar(20) NOT NULL DEFAULT 'in_stock',
  "notes" text,
  "sold_transaction_id" uuid REFERENCES "transactions"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_pieces_product" ON "pieces"("product_id");

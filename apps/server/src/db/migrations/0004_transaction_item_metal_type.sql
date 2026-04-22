-- Add metal_type to transaction_items so Day Book can show metal per transaction
ALTER TABLE "transaction_items" ADD COLUMN IF NOT EXISTS "metal_type" varchar(50);

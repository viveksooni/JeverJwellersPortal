-- Add SKU prefix column to categories
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "sku_prefix" varchar(10);

-- Add metal_types setting key (default built-in types stored as JSON)
INSERT INTO "shop_settings" ("key", "value")
VALUES (
  'metal_types',
  '[{"name":"gold","prefix":"G","label":"Gold"},{"name":"silver","prefix":"S","label":"Silver"},{"name":"platinum","prefix":"P","label":"Platinum"},{"name":"diamond","prefix":"D","label":"Diamond"},{"name":"rose gold","prefix":"RG","label":"Rose Gold"},{"name":"white gold","prefix":"WG","label":"White Gold"},{"name":"other","prefix":"X","label":"Other"}]'
)
ON CONFLICT ("key") DO NOTHING;

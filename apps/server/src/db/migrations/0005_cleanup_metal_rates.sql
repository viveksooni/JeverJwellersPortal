-- Remove gold 14k, platinum, and silver_999 (consolidated into plain 'silver')
DELETE FROM metal_rates WHERE metal_type IN ('gold_14k', 'platinum_950', 'silver_999');

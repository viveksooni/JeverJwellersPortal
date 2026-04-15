export const METAL_TYPES = ['gold', 'silver', 'platinum', 'diamond', 'other'] as const;
export type MetalType = typeof METAL_TYPES[number];

export const GOLD_PURITIES = ['24K', '22K', '18K', '14K', '10K'] as const;
export const SILVER_PURITIES = ['999', '925', '800'] as const;
export const PLATINUM_PURITIES = ['950', '900', '850'] as const;

export type GoldPurity = typeof GOLD_PURITIES[number];
export type SilverPurity = typeof SILVER_PURITIES[number];
export type PlatinumPurity = typeof PLATINUM_PURITIES[number];

export const METAL_RATE_KEYS = [
  'gold_24k',
  'gold_22k',
  'gold_18k',
  'gold_14k',
  'silver_999',
  'silver_925',
  'platinum_950',
] as const;
export type MetalRateKey = typeof METAL_RATE_KEYS[number];

export const METAL_RATE_LABELS: Record<MetalRateKey, string> = {
  gold_24k: 'Gold 24K',
  gold_22k: 'Gold 22K',
  gold_18k: 'Gold 18K',
  gold_14k: 'Gold 14K',
  silver_999: 'Silver 999',
  silver_925: 'Silver 925',
  platinum_950: 'Platinum 950',
};

export const STONE_TYPES = [
  'diamond',
  'ruby',
  'emerald',
  'sapphire',
  'pearl',
  'topaz',
  'other',
] as const;
export type StoneType = typeof STONE_TYPES[number];

export const MAKING_CHARGE_TYPES = ['flat', 'per_gram', 'percentage'] as const;
export type MakingChargeType = typeof MAKING_CHARGE_TYPES[number];

export const TRANSACTION_TYPES = [
  'sale',
  'purchase',
  'repair',
  'exchange',
  'custom_order',
] as const;
export type TransactionType = typeof TRANSACTION_TYPES[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  repair: 'Repair',
  exchange: 'Exchange',
  custom_order: 'Custom Order',
};

export const TRANSACTION_STATUSES = [
  'pending',
  'completed',
  'cancelled',
  'in_progress',
] as const;
export type TransactionStatus = typeof TRANSACTION_STATUSES[number];

export const PAYMENT_METHODS = [
  'cash',
  'card',
  'upi',
  'bank_transfer',
  'cheque',
  'mixed',
] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const REPAIR_STATUSES = [
  'received',
  'in_progress',
  'ready',
  'delivered',
] as const;
export type RepairStatus = typeof REPAIR_STATUSES[number];

export const INVENTORY_MOVEMENT_TYPES = [
  'in',
  'out',
  'adjustment',
  'repair_hold',
  'repair_return',
] as const;
export type InventoryMovementType = typeof INVENTORY_MOVEMENT_TYPES[number];

// GST rates applicable to jewelry in India
export const GST_RATES = [0, 3, 5, 12, 18] as const;
export type GstRate = typeof GST_RATES[number];

export const DEFAULT_JEWELRY_GST_RATE: GstRate = 3; // 3% GST on gold/silver jewelry

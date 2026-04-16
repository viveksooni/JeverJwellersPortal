import type { Product } from './product.js';
import type { InventoryMovementType } from '../constants/jewelry.js';

export interface InventoryItem {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  totalWeightG: string | null;
  minStockAlert: number;
  location: string | null;
  lastUpdated: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  product?: Pick<Product, 'id' | 'name'>;
  movementType: InventoryMovementType;
  quantity: number;
  weightG: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface AdjustInventoryDto {
  quantity: number;
  weightG?: string;
  notes?: string;
  location?: string;
  minStockAlert?: number;
}

export interface InventoryFilters {
  lowStock?: boolean;
  search?: string;
  categoryId?: number;
  page?: number;
  limit?: number;
}

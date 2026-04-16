import type {
  MetalType,
  StoneType,
  MakingChargeType,
} from '../constants/jewelry.js';

export interface Category {
  id: number;
  name: string;
  description: string | null;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Product {
  id: string;
  categoryId: number | null;
  category?: Category;
  name: string;
  sku: string | null;
  description: string | null;
  metalType: MetalType | null;
  purity: string | null;
  grossWeightG: string | null;
  netWeightG: string | null;
  stoneType: StoneType | null;
  stoneWeightCt: string | null;
  makingCharge: string | null;
  makingType: MakingChargeType;
  isActive: boolean;
  attributes: Record<string, unknown>;
  images: ProductImage[];
  inventory?: InventorySummary;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySummary {
  quantity: number;
  totalWeightG: string | null;
  minStockAlert: number;
  location: string | null;
}

export interface CreateProductDto {
  categoryId?: number;
  name: string;
  sku?: string;
  description?: string;
  metalType?: MetalType;
  purity?: string;
  grossWeightG?: string;
  netWeightG?: string;
  stoneType?: StoneType;
  stoneWeightCt?: string;
  makingCharge?: string;
  makingType?: MakingChargeType;
  attributes?: Record<string, unknown>;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {
  isActive?: boolean;
}

export interface ProductFilters {
  categoryId?: number;
  metalType?: MetalType;
  purity?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

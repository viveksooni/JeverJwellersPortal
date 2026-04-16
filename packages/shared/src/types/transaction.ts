import type {
  TransactionType,
  TransactionStatus,
  PaymentMethod,
  PaymentStatus,
  RepairStatus,
} from '../constants/jewelry.js';
import type { Customer } from './customer.js';
import type { Product } from './product.js';

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId: string | null;
  product?: Pick<Product, 'id' | 'name' | 'images'>;
  productName: string;
  quantity: number;
  weightG: string | null;
  purity: string | null;
  ratePerGram: string | null;
  makingCharge: string | null;
  stoneCharge: string;
  unitPrice: string;
  totalPrice: string;
  isExchangeItem: boolean;
}

export interface RepairOrder {
  id: string;
  transactionId: string;
  itemDescription: string;
  issueDescribed: string | null;
  repairType: string | null;
  estimatedDays: number | null;
  deliveryDate: string | null;
  repairCharge: string | null;
  actualWeightG: string | null;
  status: RepairStatus;
  technicianNotes: string | null;
}

export interface Transaction {
  id: string;
  transactionNo: string;
  type: TransactionType;
  status: TransactionStatus;
  customerId: string | null;
  customer?: Customer;
  totalAmount: string;
  discountAmount: string;
  taxAmount: string;
  finalAmount: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  amountPaid: string;
  notes: string | null;
  goldRate: string | null;
  silverRate: string | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
  items?: TransactionItem[];
  repairOrder?: RepairOrder;
}

export interface CreateTransactionItemDto {
  productId?: string;
  productName: string;
  quantity: number;
  weightG?: string;
  purity?: string;
  ratePerGram?: string;
  makingCharge?: string;
  stoneCharge?: string;
  unitPrice: string;
  totalPrice: string;
  isExchangeItem?: boolean;
}

export interface CreateTransactionDto {
  type: TransactionType;
  customerId?: string;
  totalAmount: string;
  discountAmount?: string;
  taxAmount?: string;
  finalAmount: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  amountPaid?: string;
  notes?: string;
  goldRate?: string;
  silverRate?: string;
  transactionDate?: string;
  items: CreateTransactionItemDto[];
  repairOrder?: {
    itemDescription: string;
    issueDescribed?: string;
    repairType?: string;
    estimatedDays?: number;
    deliveryDate?: string;
    repairCharge?: string;
    actualWeightG?: string;
  };
}

export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // computed
  totalTransactions?: number;
  totalSpent?: string;
}

export interface CreateCustomerDto {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export interface CustomerFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface DashboardSummary {
  todayRevenue: string;
  todayTransactions: number;
  todayNewCustomers: number;
  weekRevenue: string;
  weekTransactions: number;
  monthRevenue: string;
  monthTransactions: number;
  lowStockCount: number;
  pendingRepairs: number;
}

export interface SalesDataPoint {
  date: string;       // ISO date or label (e.g., "Mon", "Jan")
  revenue: number;
  transactions: number;
}

export interface HeatmapDataPoint {
  date: string;       // ISO date string YYYY-MM-DD
  count: number;      // number of transactions
  revenue: number;
}

export interface TransactionTypeBreakdown {
  type: string;
  count: number;
  revenue: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: string;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newThisMonth: number;
  repeatCustomers: number;
  topCustomers: {
    customerId: string;
    customerName: string;
    totalSpent: string;
    transactionCount: number;
  }[];
}

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year';

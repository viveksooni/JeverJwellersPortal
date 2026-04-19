import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { InventoryPage } from '@/pages/inventory/InventoryPage';
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { TransactionsPage } from '@/pages/transactions/TransactionsPage';
import { NewTransactionPage } from '@/pages/transactions/NewTransactionPage';
import { TransactionFormPage } from '@/pages/transactions/TransactionFormPage';
import { TransactionDetailPage } from '@/pages/transactions/TransactionDetailPage';
import { InvoicesPage } from '@/pages/invoices/InvoicesPage';
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage';
import { StockConsolidatedPage } from '@/pages/inventory/StockConsolidatedPage';
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'products/:id', element: <ProductDetailPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'customers/:id', element: <CustomerDetailPage /> },
          { path: 'stock', element: <StockConsolidatedPage /> },
          { path: 'transactions', element: <TransactionsPage /> },
          { path: 'transactions/new', element: <NewTransactionPage /> },
          { path: 'transactions/new/:type', element: <TransactionFormPage /> },
          { path: 'transactions/:id', element: <TransactionDetailPage /> },
          { path: 'invoices', element: <InvoicesPage /> },
          { path: 'analytics', element: <AnalyticsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/:tab', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

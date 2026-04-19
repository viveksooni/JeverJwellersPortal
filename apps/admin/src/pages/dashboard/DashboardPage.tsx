import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  AlertTriangle,
  Wrench,
  IndianRupee,
  ArrowRight,
  Plus,
  Loader2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { METAL_RATE_LABELS } from '@jever/shared';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  color?: string;
}

function MetricCard({ title, value, icon: Icon, sub, color = 'text-gold-500' }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-heading font-semibold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-full p-2.5 bg-secondary ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Add Customer Quick Dialog ────────────────────────────────────────────────

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
});
type CustomerFormData = z.infer<typeof customerSchema>;

function AddCustomerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (data: CustomerFormData) => api.post('/customers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      toast({ variant: 'success', title: 'Customer added' });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add customer' }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input {...register('name')} placeholder="Customer name" autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register('phone')} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register('email')} type="email" placeholder="email@example.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input {...register('address')} placeholder="Full address" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Product Quick Dialog ─────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().optional(),
  metalType: z.string().optional(),
  grossWeightG: z.string().optional(),
  trackingType: z.enum(['template', 'per_piece']).default('template'),
});
type ProductFormData = z.infer<typeof productSchema>;

function AddProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { trackingType: 'template' },
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (data: ProductFormData) => api.post('/products', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ variant: 'success', title: 'Product added', description: 'You can add more details on the products page.' });
      onClose();
      navigate('/products');
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add product' }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Add Product</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Fill in the essentials now. You can add more details (images, purity, etc.) from the Products page.</p>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product Name *</Label>
            <Input {...register('name')} placeholder="e.g. 22K Gold Necklace" autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input {...register('sku')} placeholder="e.g. GR-001" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Metal Type</Label>
              <Input {...register('metalType')} placeholder="gold, silver…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Gross Weight (g)</Label>
            <Input {...register('grossWeightG')} placeholder="12.500" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => api.get('/analytics/summary').then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const { data: salesData } = useQuery({
    queryKey: ['analytics', 'sales', 'week'],
    queryFn: () => api.get('/analytics/sales?period=week').then((r) => r.data.data),
  });

  const { data: recentTxns } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => api.get('/transactions?limit=5').then((r) => r.data.data),
  });

  const { data: ratesData } = useQuery({
    queryKey: ['rates', 'today'],
    queryFn: () => api.get('/rates/today').then((r) => r.data.data),
  });

  const chartData = (salesData ?? []).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: parseFloat(d.revenue ?? 0),
    transactions: parseInt(d.transactions ?? 0),
  }));

  const rateEntries = ratesData
    ? Object.entries(ratesData as Record<string, string | null>).filter(([, v]) => v !== null)
    : [];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        description={`Today — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        action={
          <Link to="/transactions/new/sale">
            <Button variant="gold" size="sm">+ New Sale</Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Metric Cards — New Customers is last */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Today's Revenue"
            value={formatCurrency(summary?.todayRevenue)}
            icon={IndianRupee}
            sub={`${summary?.todayTransactions ?? 0} sales`}
            color="text-gold-500"
          />
          <MetricCard
            title="This Week"
            value={formatCurrency(summary?.weekRevenue)}
            icon={TrendingUp}
            sub={`${summary?.weekTransactions ?? 0} transactions`}
            color="text-blue-500"
          />
          <MetricCard
            title="This Month"
            value={formatCurrency(summary?.monthRevenue)}
            icon={ShoppingBag}
            sub={`${summary?.monthTransactions ?? 0} transactions`}
            color="text-violet-500"
          />
          <MetricCard
            title="New Customers"
            value={summary?.todayNewCustomers ?? 0}
            icon={Users}
            sub="registered today"
            color="text-emerald-500"
          />
        </div>

        {/* Alerts Row */}
        {((summary?.lowStockCount ?? 0) > 0 || (summary?.pendingRepairs ?? 0) > 0) && (
          <div className="flex gap-3 flex-wrap">
            {(summary?.lowStockCount ?? 0) > 0 && (
              <Link to="/inventory?lowStock=true">
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800 text-sm hover:bg-amber-100 transition-colors">
                  <AlertTriangle className="h-4 w-4" />
                  <strong>{summary.lowStockCount}</strong> items low on stock
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )}
            {(summary?.pendingRepairs ?? 0) > 0 && (
              <Link to="/transactions?type=repair">
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-blue-800 text-sm hover:bg-blue-100 transition-colors">
                  <Wrench className="h-4 w-4" />
                  <strong>{summary.pendingRepairs}</strong> repairs pending
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue — Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C9972A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C9972A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 25% 90%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(v), 'Revenue']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#C9972A"
                    strokeWidth={2}
                    fill="url(#goldGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Right column: Rates + Quick Actions */}
          <div className="flex flex-col gap-4">
            {/* Today's Rates — as rows */}
            {rateEntries.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm text-gold-700">Today's Rates</CardTitle>
                  <Link to="/settings/rates">
                    <Button variant="ghost" size="sm" className="text-xs h-6 text-gold-600 hover:text-gold-700 px-2">
                      Update
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  <div className="divide-y divide-border">
                    {rateEntries.map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-muted-foreground">
                          {(METAL_RATE_LABELS as any)[key] ?? key.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold font-mono">
                          ₹{parseFloat(val!).toLocaleString('en-IN')}<span className="text-[10px] text-muted-foreground font-normal">/g</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Link to="/transactions/new/sale">
                  <Button variant="gold" size="sm" className="w-full justify-start">New Sale</Button>
                </Link>
                <Link to="/transactions/new/purchase">
                  <Button variant="outline" size="sm" className="w-full justify-start">New Purchase</Button>
                </Link>
                <Link to="/transactions/new/repair">
                  <Button variant="outline" size="sm" className="w-full justify-start">Repair Order</Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowAddCustomer(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Customer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowAddProduct(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Product
                </Button>
                <Link to="/analytics">
                  <Button variant="outline" size="sm" className="w-full justify-start">View Analytics</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link to="/transactions">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {(recentTxns ?? []).map((txn: any) => (
                <Link
                  key={txn.id}
                  to={`/transactions/${txn.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-muted/40 rounded-md px-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{txn.transactionNo}</p>
                    <p className="text-xs text-muted-foreground">{txn.customer?.name ?? 'Walk-in'} · {formatDateTime(txn.transactionDate)}</p>
                  </div>
                  <Badge
                    variant={txn.type === 'sale' ? 'success' : txn.type === 'repair' ? 'info' : 'warning'}
                    className="capitalize text-xs"
                  >
                    {txn.type}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(txn.finalAmount)}</span>
                </Link>
              ))}
              {(!recentTxns || recentTxns.length === 0) && (
                <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AddCustomerDialog open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
      <AddProductDialog open={showAddProduct} onClose={() => setShowAddProduct(false)} />
    </div>
  );
}

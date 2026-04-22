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
  BookOpen,
  ShoppingCart,
  Package,
  ChevronRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
    onSuccess: () => {
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title, value, sub, icon: Icon, accent = 'gold',
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: 'gold' | 'blue' | 'violet' | 'emerald';
}) {
  const colors: Record<string, { bg: string; icon: string; border: string }> = {
    gold:    { bg: 'bg-gold-50',    icon: 'text-gold-600',    border: 'border-gold-200' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-200' },
    violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600',  border: 'border-violet-200' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-200' },
  };
  const c = colors[accent];

  return (
    <Card className={`border ${c.border} ${c.bg}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-heading font-semibold truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${c.bg} ${c.icon} shrink-0 border ${c.border}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
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

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full">
      {/* ── Top header bar ── */}
      <div className="border-b border-border bg-background px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{today}</p>
        </div>
        <Link to="/transactions/new/sale">
          <Button variant="gold" size="sm" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" /> New Sale
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Alerts ── */}
        {((summary?.lowStockCount ?? 0) > 0 || (summary?.pendingRepairs ?? 0) > 0) && (
          <div className="flex gap-3 flex-wrap px-6 pt-4">
            {(summary?.lowStockCount ?? 0) > 0 && (
              <Link to="/inventory?lowStock=true">
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-xs font-medium hover:bg-amber-100 transition-colors">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <strong>{summary.lowStockCount}</strong> items low on stock
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )}
            {(summary?.pendingRepairs ?? 0) > 0 && (
              <Link to="/transactions?type=repair">
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800 text-xs font-medium hover:bg-blue-100 transition-colors">
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  <strong>{summary.pendingRepairs}</strong> repairs pending
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Today's Revenue"
              value={formatCurrency(summary?.todayRevenue)}
              sub={`${summary?.todayTransactions ?? 0} sales today`}
              icon={IndianRupee}
              accent="gold"
            />
            <StatCard
              title="This Week"
              value={formatCurrency(summary?.weekRevenue)}
              sub={`${summary?.weekTransactions ?? 0} transactions`}
              icon={TrendingUp}
              accent="blue"
            />
            <StatCard
              title="This Month"
              value={formatCurrency(summary?.monthRevenue)}
              sub={`${summary?.monthTransactions ?? 0} transactions`}
              icon={ShoppingBag}
              accent="violet"
            />
            <StatCard
              title="New Customers"
              value={summary?.todayNewCustomers ?? 0}
              sub="registered today"
              icon={Users}
              accent="emerald"
            />
          </div>

          {/* ── Main content grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Left: chart + recent transactions */}
            <div className="xl:col-span-2 space-y-6">

              {/* Revenue Chart */}
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Revenue — Last 7 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#C9972A" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#C9972A" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 25% 92%)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={42} />
                        <Tooltip
                          formatter={(v: any) => [formatCurrency(v), 'Revenue']}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(38 25% 88%)' }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#C9972A" strokeWidth={2} fill="url(#goldGrad)" dot={{ r: 3, fill: '#C9972A' }} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[190px] flex items-center justify-center text-sm text-muted-foreground">
                      No sales data yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
                  <Link to="/transactions">
                    <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-muted-foreground hover:text-foreground">
                      View all <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="pt-0">
                  {(recentTxns ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {(recentTxns ?? []).map((txn: any) => (
                        <Link
                          key={txn.id}
                          to={`/transactions/${txn.id}`}
                          className="flex items-center gap-3 py-3 hover:bg-muted/40 rounded-md px-2 -mx-2 transition-colors"
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                            ${txn.type === 'sale' ? 'bg-emerald-100 text-emerald-700' :
                              txn.type === 'repair' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'}`}>
                            {txn.type === 'sale' ? '₹' : txn.type === 'repair' ? 'R' : 'P'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground leading-tight">{txn.transactionNo}</p>
                            <p className="text-xs text-muted-foreground">{txn.customer?.name ?? 'Walk-in'} · {formatDateTime(txn.transactionDate)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">{formatCurrency(txn.finalAmount)}</p>
                            <Badge
                              variant={txn.type === 'sale' ? 'success' : txn.type === 'repair' ? 'info' : 'warning'}
                              className="capitalize text-[10px] mt-0.5"
                            >
                              {txn.type}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: rates + quick actions */}
            <div className="space-y-5">

              {/* Today's Rates */}
              {rateEntries.length > 0 && (
                <Card className="border-gold-200">
                  <CardHeader className="pb-2 flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-gold-700">Today's Rates</CardTitle>
                    <Link to="/settings/rates">
                      <Button variant="ghost" size="sm" className="text-xs h-6 text-gold-600 hover:text-gold-700 px-2">
                        Update
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="divide-y divide-border">
                      {rateEntries.map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between py-2">
                          <span className="text-xs text-muted-foreground">
                            {(METAL_RATE_LABELS as any)[key] ?? key.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-sm font-semibold font-mono text-foreground">
                            ₹{parseFloat(val!).toLocaleString('en-IN')}
                            <span className="text-[10px] text-muted-foreground font-normal">/g</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Link to="/transactions/new/sale" className="block">
                    <div className="flex items-center gap-3 rounded-lg border border-gold-200 bg-gold-50 hover:bg-gold-100 px-3 py-2.5 transition-colors cursor-pointer">
                      <ShoppingCart className="h-4 w-4 text-gold-600 shrink-0" />
                      <span className="text-sm font-medium text-gold-800">New Sale</span>
                      <ChevronRight className="h-3.5 w-3.5 text-gold-500 ml-auto" />
                    </div>
                  </Link>

                  <Link to="/transactions/new/purchase" className="block">
                    <div className="flex items-center gap-3 rounded-lg border border-border hover:bg-accent px-3 py-2.5 transition-colors cursor-pointer">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">New Purchase</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    </div>
                  </Link>

                  <Link to="/transactions/new/repair" className="block">
                    <div className="flex items-center gap-3 rounded-lg border border-border hover:bg-accent px-3 py-2.5 transition-colors cursor-pointer">
                      <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">Repair Order</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    </div>
                  </Link>

                  <Link to="/stock" className="block">
                    <div className="flex items-center gap-3 rounded-lg border border-border hover:bg-accent px-3 py-2.5 transition-colors cursor-pointer">
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">Day Book</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    </div>
                  </Link>

                  <div className="pt-1 border-t border-border space-y-2">
                    <button
                      type="button"
                      className="flex items-center gap-3 rounded-lg border border-border hover:bg-accent px-3 py-2.5 transition-colors cursor-pointer w-full text-left"
                      onClick={() => setShowAddCustomer(true)}
                    >
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">Add Customer</span>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    </button>

                    <button
                      type="button"
                      className="flex items-center gap-3 rounded-lg border border-border hover:bg-accent px-3 py-2.5 transition-colors cursor-pointer w-full text-left"
                      onClick={() => setShowAddProduct(true)}
                    >
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">Add Product</span>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <AddCustomerDialog open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
      <AddProductDialog open={showAddProduct} onClose={() => setShowAddProduct(false)} />
    </div>
  );
}

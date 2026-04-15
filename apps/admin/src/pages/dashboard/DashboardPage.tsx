import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  AlertTriangle,
  Wrench,
  IndianRupee,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

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

export function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
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
        {/* Today's Rates Strip */}
        {ratesData && (
          <div className="rounded-lg border border-gold-200 bg-gold-50 px-4 py-2.5 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-600">Today's Rates</span>
            {Object.entries(ratesData as Record<string, string | null>)
              .filter(([, v]) => v !== null)
              .map(([key, val]) => (
                <span key={key} className="text-sm font-medium text-foreground">
                  <span className="text-gold-600 text-xs">{key.replace('_', ' ').toUpperCase()}</span>{' '}
                  ₹{parseFloat(val!).toLocaleString('en-IN')}/g
                </span>
              ))}
            <Link to="/settings/rates" className="ml-auto">
              <Button variant="outline" size="sm" className="text-xs h-7 border-gold-300">Update Rates</Button>
            </Link>
          </div>
        )}

        {/* Metric Cards */}
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
            title="New Customers"
            value={summary?.todayNewCustomers ?? 0}
            icon={Users}
            sub="registered today"
            color="text-emerald-500"
          />
          <MetricCard
            title="This Month"
            value={formatCurrency(summary?.monthRevenue)}
            icon={ShoppingBag}
            sub={`${summary?.monthTransactions ?? 0} transactions`}
            color="text-violet-500"
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

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                { label: 'New Sale', to: '/transactions/new/sale', color: 'gold' as const },
                { label: 'New Purchase', to: '/transactions/new/purchase', color: 'outline' as const },
                { label: 'Repair Order', to: '/transactions/new/repair', color: 'outline' as const },
                { label: 'Add Customer', to: '/customers/new', color: 'outline' as const },
                { label: 'Add Product', to: '/products/new', color: 'outline' as const },
                { label: 'View Analytics', to: '/analytics', color: 'outline' as const },
              ].map((action) => (
                <Link key={action.to} to={action.to}>
                  <Button variant={action.color} size="sm" className="w-full justify-start">
                    {action.label}
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>
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
    </div>
  );
}

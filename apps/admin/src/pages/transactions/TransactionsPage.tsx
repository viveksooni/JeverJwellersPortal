import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { TRANSACTION_TYPE_LABELS } from '@jever/shared';

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'info' | 'destructive' | 'secondary'> = {
  completed: 'success',
  in_progress: 'info',
  pending: 'warning',
  cancelled: 'destructive',
};

const TYPE_VARIANTS: Record<string, 'gold' | 'info' | 'warning' | 'secondary' | 'outline'> = {
  sale: 'gold',
  purchase: 'secondary',
  repair: 'info',
  exchange: 'warning',
  custom_order: 'outline',
};

export function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [type, setType] = useState(() => searchParams.get('type') ?? 'all');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? 'all');

  // Sync when URL changes (e.g. navigating from dashboard with ?type=repair)
  useEffect(() => {
    const urlType = searchParams.get('type');
    const urlStatus = searchParams.get('status');
    if (urlType) setType(urlType);
    if (urlStatus) setStatus(urlStatus);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', search, type, status],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      if (type && type !== 'all') params.set('type', type);
      if (status && status !== 'all') params.set('status', status);
      return api.get(`/transactions?${params}`).then((r) => r.data);
    },
    staleTime: 30_000,
  });

  const transactions = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Transactions"
        description={`${data?.total ?? 0} total transactions`}
        action={
          <div className="flex gap-2">
            <Link to="/transactions/new/sale">
              <Button variant="gold" size="sm"><Plus className="h-4 w-4" /> New Sale</Button>
            </Link>
            <Link to="/transactions/new">
              <Button variant="outline" size="sm">Other</Button>
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by TXN no…" className="pl-9 w-52" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {['pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">TXN No</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Payment</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map((txn: any) => (
                <tr key={txn.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-gold-600 font-medium">{txn.transactionNo}</td>
                  <td className="px-4 py-3">
                    <Badge variant={TYPE_VARIANTS[txn.type] ?? 'outline'} className="capitalize text-xs">
                      {TRANSACTION_TYPE_LABELS[txn.type as keyof typeof TRANSACTION_TYPE_LABELS] ?? txn.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground">{txn.customer?.name ?? <span className="text-muted-foreground">Walk-in</span>}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(txn.transactionDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={STATUS_VARIANTS[txn.status] ?? 'secondary'} className="capitalize text-xs">
                      {txn.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={txn.paymentStatus === 'paid' ? 'success' : txn.paymentStatus === 'partial' ? 'warning' : 'secondary'}
                      className="text-xs capitalize"
                    >
                      {txn.paymentStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(txn.finalAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/transactions/${txn.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {!isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, TrendingDown, Package, Wrench, ArrowRight, Scale, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatCurrency, formatWeight } from '@/lib/utils';

const TYPE_STYLES: Record<string, { label: string; badge: any; row: string }> = {
  sale:         { label: 'Sale',         badge: 'success', row: '' },
  repair:       { label: 'Repair',       badge: 'info',    row: 'bg-blue-50/40' },
  exchange:     { label: 'Exchange',     badge: 'warning', row: 'bg-amber-50/40' },
  purchase:     { label: 'Purchase',     badge: 'outline', row: '' },
  custom_order: { label: 'Custom Order', badge: 'outline', row: '' },
};

const METAL_COLORS: Record<string, string> = {
  gold:   'bg-amber-100 text-amber-800 border-amber-300',
  silver: 'bg-slate-100 text-slate-700 border-slate-300',
};

function getItemMetals(items: any[]): string[] {
  const metals = [...new Set(
    items
      .filter((i: any) => !i.isExchangeItem && i.metalType)
      .map((i: any) => (i.metalType as string).toLowerCase())
  )];
  return metals;
}

function formatTimeIST(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

export function StockConsolidatedPage() {
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [metalFilter, setMetalFilter] = useState('all');

  const today = new Date().toISOString().split('T')[0];

  const { data: todayTxns = [], isLoading } = useQuery({
    queryKey: ['transactions', 'today'],
    queryFn: () =>
      api.get(`/transactions?from=${today}&to=${today}&limit=200`).then((r) => r.data.data ?? []),
    staleTime: 30_000,
  });

  const { data: consolidated } = useQuery({
    queryKey: ['stock-consolidated'],
    queryFn: () => api.get('/analytics/stock-consolidated').then((r) => r.data.data),
    staleTime: 30_000,
  });

  const goldPiecesSoldToday: number = consolidated?.goldPiecesSoldToday ?? 0;
  const silverOpeningG: number      = consolidated?.silverOpeningG ?? 0;
  const silverSoldTodayG: number    = consolidated?.silverSoldTodayG ?? 0;
  const silverClosingG: number      = consolidated?.silverClosingG ?? 0;

  const filtered = (todayTxns as any[]).filter((txn) => {
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false;

    if (metalFilter !== 'all') {
      const metals = getItemMetals(txn.items ?? []);
      if (!metals.includes(metalFilter)) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      const matchTxn     = txn.transactionNo?.toLowerCase().includes(q);
      const matchCust    = txn.customer?.name?.toLowerCase().includes(q);
      const matchPhone   = txn.customer?.phone?.toLowerCase().includes(q);
      const matchNotes   = txn.notes?.toLowerCase().includes(q);
      const matchItems   = (txn.items ?? []).some((i: any) =>
        i.productName?.toLowerCase().includes(q) || i.metalType?.toLowerCase().includes(q)
      );
      if (!matchTxn && !matchCust && !matchPhone && !matchNotes && !matchItems) return false;
    }

    return true;
  });

  const salesTxns   = (todayTxns as any[]).filter((t) => t.type === 'sale');
  const repairTxns  = (todayTxns as any[]).filter((t) => t.type === 'repair');
  const totalRevenue = salesTxns.reduce((s: number, t: any) => s + parseFloat(t.finalAmount ?? '0'), 0);

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Day Book" description={`Today's activity — ${dateLabel}`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-100 p-2">
                  <TrendingDown className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-emerald-700">{salesTxns.length}</p>
                  <p className="text-xs text-muted-foreground">Sales Today</p>
                  <p className="text-sm font-semibold text-emerald-700 mt-0.5">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-300 bg-amber-50/40">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2">
                  <Tag className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-amber-800">{goldPiecesSoldToday}</p>
                  <p className="text-xs text-muted-foreground">Gold Pieces Sold</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <Wrench className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-blue-700">{repairTxns.length}</p>
                  <p className="text-xs text-muted-foreground">Repairs Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-300 bg-slate-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-full bg-slate-100 p-1.5">
                  <Scale className="h-4 w-4 text-slate-600" />
                </div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Silver Weight</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Opening</span>
                  <span className="text-sm font-semibold text-slate-700">{formatWeight(silverOpeningG)}</span>
                </div>
                <div className="flex justify-between items-center text-red-600">
                  <span className="text-xs">Sold Today</span>
                  <span className="text-sm font-semibold">− {formatWeight(silverSoldTodayG)}</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-medium">Closing</span>
                  <span className="text-sm font-bold text-slate-800">{formatWeight(silverClosingG)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transaction, customer, item…"
              className="pl-9 w-72"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="purchase">Purchase</SelectItem>
              <SelectItem value="repair">Repair</SelectItem>
              <SelectItem value="exchange">Exchange</SelectItem>
              <SelectItem value="custom_order">Custom Order</SelectItem>
            </SelectContent>
          </Select>

          <Select value={metalFilter} onValueChange={setMetalFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Metals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Metals</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
            </SelectContent>
          </Select>

          {(typeFilter !== 'all' || metalFilter !== 'all' || search) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground h-9"
              onClick={() => { setTypeFilter('all'); setMetalFilter('all'); setSearch(''); }}
            >
              Clear
            </Button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} of {(todayTxns as any[]).length} transactions
          </span>
        </div>

        {/* ── Transactions Table ── */}
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Transaction</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Items</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Metal</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Weight</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Payment</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Time (IST)</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((txn: any) => {
                const style  = TYPE_STYLES[txn.type] ?? TYPE_STYLES.sale;
                const items: any[] = (txn.items ?? []).filter((i: any) => !i.isExchangeItem);
                const totalWeightG = items.reduce((s: number, i: any) => s + parseFloat(i.weightG ?? '0'), 0);
                const itemSummary  = items.map((i: any) => i.productName).filter(Boolean).join(', ');
                const metals       = getItemMetals(txn.items ?? []);

                return (
                  <tr key={txn.id} className={`${style.row || ''} hover:bg-muted/20`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gold-700 whitespace-nowrap">
                      {txn.transactionNo}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={style.badge as any} className="text-[10px]">
                        {style.label}
                      </Badge>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-medium text-sm">
                        {txn.customer?.name ?? <span className="text-muted-foreground italic text-xs">Walk-in</span>}
                      </span>
                      {txn.customer?.phone && (
                        <p className="text-xs text-muted-foreground">{txn.customer.phone}</p>
                      )}
                    </td>

                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="text-xs text-foreground truncate" title={itemSummary}>
                        {itemSummary || <span className="text-muted-foreground">—</span>}
                      </p>
                      {items.length > 1 && (
                        <p className="text-[10px] text-muted-foreground">{items.length} items</p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {metals.length > 0 ? metals.map((m) => (
                          <span
                            key={m}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${METAL_COLORS[m] ?? 'bg-secondary text-muted-foreground border-border'}`}
                          >
                            {m}
                          </span>
                        )) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {totalWeightG > 0
                        ? formatWeight(totalWeightG)
                        : txn.totalWeightG
                          ? formatWeight(txn.totalWeightG)
                          : '—'}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      {formatCurrency(txn.finalAmount)}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          txn.paymentStatus === 'paid'    ? 'success' :
                          txn.paymentStatus === 'partial' ? 'warning' : 'outline'
                        }
                        className="text-[10px] capitalize"
                      >
                        {txn.paymentStatus ?? '—'}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeIST(txn.createdAt ?? txn.transactionDate)}
                    </td>

                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-xs text-muted-foreground truncate" title={txn.notes ?? ''}>
                        {txn.notes ?? <span className="italic">—</span>}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <Link to={`/transactions/${txn.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {(todayTxns as any[]).length === 0
                      ? 'No transactions recorded today yet'
                      : 'No results match your filters'}
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

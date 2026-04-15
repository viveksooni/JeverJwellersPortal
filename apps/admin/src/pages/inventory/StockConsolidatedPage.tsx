import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingDown, Package, Scale, Gem } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatWeight, formatCurrency } from '@/lib/utils';

export function StockConsolidatedPage() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'gold' | 'silver' | 'all'>('gold');

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then((r) => r.data.data),
    staleTime: 30_000,
  });

  const { data: consolidated } = useQuery({
    queryKey: ['stock-consolidated'],
    queryFn: () => api.get('/analytics/stock-consolidated').then((r) => r.data.data),
    staleTime: 30_000,
  });

  const todaySales: Record<string, { qtySold: number; weightSold: number; revenue: number }> =
    consolidated?.todaySales ?? {};

  // Filter inventory
  const filtered = inventory.filter((item: any) => {
    const p = item.product;
    if (!p) return false;
    const matchSearch =
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      tab === 'all' ||
      (tab === 'gold' && p.metalType === 'gold') ||
      (tab === 'silver' && p.metalType === 'silver');
    return matchSearch && matchTab;
  });

  // Summary cards
  const goldItems = inventory.filter((i: any) => i.product?.metalType === 'gold');
  const silverItems = inventory.filter((i: any) => i.product?.metalType === 'silver');

  const goldPiecesTotal = goldItems.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0);
  const silverWeightTotal = silverItems.reduce((s: number, i: any) => s + parseFloat(i.totalWeightG ?? '0'), 0);

  const goldSoldToday = Object.entries(todaySales)
    .filter(([pid]) => goldItems.some((i: any) => i.productId === pid))
    .reduce((s, [, v]) => s + v.qtySold, 0);
  const silverSoldWeightToday = Object.entries(todaySales)
    .filter(([pid]) => silverItems.some((i: any) => i.productId === pid))
    .reduce((s, [, v]) => s + v.weightSold, 0);

  const todayRevenue = Object.values(todaySales).reduce((s, v) => s + v.revenue, 0);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Stock Register"
        description={`Today's consolidated stock position — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-gold-200 bg-gold-50/50">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gold-100 p-2">
                  <Gem className="h-5 w-5 text-gold-600" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-gold-700">{goldPiecesTotal}</p>
                  <p className="text-xs text-muted-foreground">Gold Pieces (Total)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/30">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-red-700">{goldSoldToday}</p>
                  <p className="text-xs text-muted-foreground">Gold Pieces Sold Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-slate-50/50">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-100 p-2">
                  <Scale className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-slate-700">{formatWeight(silverWeightTotal)}</p>
                  <p className="text-xs text-muted-foreground">Silver Weight (Total)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-100 p-2">
                  <Package className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-lg font-heading font-bold text-emerald-700">{formatCurrency(todayRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Today's Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Silver Daily Weight */}
        {tab !== 'gold' && silverItems.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                <Scale className="h-4 w-4" /> Silver Daily Weight Register
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xl font-heading font-bold">{formatWeight(silverWeightTotal + silverSoldWeightToday)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Opening Weight (Day Start)</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-xl font-heading font-bold text-red-600">-{formatWeight(silverSoldWeightToday)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sold Today</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xl font-heading font-bold text-emerald-700">{formatWeight(silverWeightTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Current Weight</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SKU or product name…"
              className="pl-9 w-72"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {(['gold', 'silver', 'all'] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? 'gold' : 'outline'}
                onClick={() => setTab(t)}
                className="capitalize"
              >
                {t === 'all' ? 'All Metals' : t}
              </Button>
            ))}
          </div>
        </div>

        {/* Stock Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">SKU</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Metal</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Stock (Pcs)</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total Weight</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-red-600">Sold Today</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Wt Sold</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Location</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item: any) => {
                const p = item.product;
                const sale = todaySales[item.productId] ?? { qtySold: 0, weightSold: 0, revenue: 0 };
                const isLow = item.quantity <= item.minStockAlert;
                return (
                  <tr key={item.id} className={isLow ? 'bg-amber-50/50' : 'hover:bg-muted/30'}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gold-700">
                      {p?.sku ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p?.images?.[0] && (
                          <img src={p.images[0].url} alt="" className="h-8 w-8 rounded object-cover" />
                        )}
                        <span className="font-medium max-w-[180px] truncate">{p?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="text-[10px] w-fit capitalize">{p?.metalType ?? '—'}</Badge>
                        {p?.purity && <span className="text-[10px] text-muted-foreground">{p.purity}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-lg font-heading">
                      <span className={isLow ? 'text-amber-600' : ''}>{item.quantity}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{formatWeight(item.totalWeightG)}</td>
                    <td className="px-4 py-3 text-right">
                      {sale.qtySold > 0 ? (
                        <span className="font-semibold text-red-600">-{sale.qtySold}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {sale.weightSold > 0 ? (
                        <span className="text-red-600">-{formatWeight(sale.weightSold)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.location ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {isLow ? (
                        <Badge variant="warning" className="text-[10px]">Low Stock</Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">OK</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No products found
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

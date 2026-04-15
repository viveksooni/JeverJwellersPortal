import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { AnalyticsPeriod } from '@jever/shared';

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  day: 'Today', week: 'This Week', month: 'This Month', year: 'This Year',
};
const PIE_COLORS = ['#C9972A', '#8B6914', '#e8c06a', '#5c4011', '#f5de99'];

// ─── Heatmap Tooltip ─────────────────────────────────────────────────────────

function HeatmapTooltip({ visible, x, y, data }: {
  visible: boolean; x: number; y: number;
  data: { date: string; count: number; revenue: number; remark?: string } | null;
}) {
  if (!visible || !data) return null;
  return (
    <div
      className="fixed z-[100] pointer-events-none bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs min-w-[160px]"
      style={{ left: x + 12, top: y - 60 }}
    >
      <p className="font-semibold text-foreground mb-1">
        {new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      </p>
      <p className="text-muted-foreground">{data.count} transaction{data.count !== 1 ? 's' : ''}</p>
      <p className="text-gold-600 font-medium">{formatCurrency(data.revenue)}</p>
      {data.remark && (
        <p className="mt-1 border-t border-border pt-1 text-violet-600 font-medium">🎉 {data.remark}</p>
      )}
    </div>
  );
}

// ─── Remark Dialog ────────────────────────────────────────────────────────────

function RemarkDialog({ open, onClose, date, existing, onSave }: {
  open: boolean; onClose: () => void; date: string | null;
  existing?: string; onSave: (date: string, remark: string) => void;
}) {
  const [text, setText] = useState(existing ?? '');
  if (!date) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Add Remark for {date && new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Event / Remark</Label>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Diwali sale, High footfall…"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">This note will appear in the heatmap tooltip for this day.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gold" onClick={() => { onSave(date, text); onClose(); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; data: any }>({
    visible: false, x: 0, y: 0, data: null,
  });
  const [remarkDialog, setRemarkDialog] = useState<{ open: boolean; date: string | null; existing?: string }>({
    open: false, date: null,
  });

  const qc = useQueryClient();

  const { data: salesData = [] } = useQuery({
    queryKey: ['analytics', 'sales', period],
    queryFn: () => api.get(`/analytics/sales?period=${period}`).then((r) => r.data.data),
  });

  const { data: heatmapData = [] } = useQuery({
    queryKey: ['analytics', 'heatmap', heatmapYear],
    queryFn: () => api.get(`/analytics/heatmap?year=${heatmapYear}`).then((r) => r.data.data),
  });

  const { data: remarksData = [] } = useQuery({
    queryKey: ['analytics', 'remarks', heatmapYear],
    queryFn: () => api.get(`/analytics/remarks?year=${heatmapYear}`).then((r) => r.data.data),
  });

  const { data: typeData = [] } = useQuery({
    queryKey: ['analytics', 'transaction-types'],
    queryFn: () => api.get('/analytics/transaction-types').then((r) => r.data.data),
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['analytics', 'top-products'],
    queryFn: () => api.get('/analytics/top-products').then((r) => r.data.data),
  });

  const { data: customerMetrics } = useQuery({
    queryKey: ['analytics', 'customer-metrics'],
    queryFn: () => api.get('/analytics/customer-metrics').then((r) => r.data.data),
  });

  const saveRemarkMutation = useMutation({
    mutationFn: ({ date, remark }: { date: string; remark: string }) =>
      api.post('/analytics/remarks', { date, remark }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics', 'remarks', heatmapYear] });
    },
  });

  const deleteRemarkMutation = useMutation({
    mutationFn: (date: string) => api.delete(`/analytics/remarks/${date}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics', 'remarks', heatmapYear] });
    },
  });

  // Build remark map keyed by date string
  const remarkMap: Record<string, string> = Object.fromEntries(
    (remarksData as any[]).map((r: any) => [r.date, r.remark])
  );

  const chartData = salesData.map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: parseFloat(d.revenue ?? 0),
    transactions: parseInt(d.transactions ?? 0),
  }));

  const pieData = typeData.map((d: any) => ({
    name: d.type.charAt(0).toUpperCase() + d.type.slice(1),
    value: parseInt(d.count ?? 0),
  }));

  const heatValues = heatmapData.map((d: any) => ({
    date: d.date,
    count: parseInt(d.count ?? 0),
    revenue: parseFloat(d.revenue ?? 0),
    remark: remarkMap[String(d.date).slice(0, 10)],
  }));

  const startDate = new Date(heatmapYear, 0, 1);
  const endDate = new Date(heatmapYear, 11, 31);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Analytics" description="Sales performance and business insights" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex gap-2">
          {(Object.keys(PERIOD_LABELS) as AnalyticsPeriod[]).map((p) => (
            <Button key={p} variant={period === p ? 'gold' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>

        {/* Sales Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue — {PERIOD_LABELS[period]}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 25% 90%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [formatCurrency(v), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="#C9972A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Volume + Type breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transaction Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 25% 90%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="transactions" stroke="#C9972A" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transaction Types</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Heatmap with year selector + remarks */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sales Heatmap</CardTitle>
              {/* Year Selector */}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                  onClick={() => setHeatmapYear((y) => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold w-12 text-center">{heatmapYear}</span>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                  onClick={() => setHeatmapYear((y) => Math.min(y + 1, new Date().getFullYear()))}
                  disabled={heatmapYear >= new Date().getFullYear()}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click on any day to add a remark / festival note</p>
          </CardHeader>
          <CardContent>
            <div
              className="relative"
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            >
              <CalendarHeatmap
                startDate={startDate}
                endDate={endDate}
                values={heatValues}
                classForValue={(value) => {
                  if (!value || value.count === 0) return 'color-empty';
                  if (value.count <= 2) return 'color-scale-1';
                  if (value.count <= 5) return 'color-scale-2';
                  if (value.count <= 10) return 'color-scale-3';
                  return 'color-scale-4';
                }}
                tooltipDataAttrs={(value: any) =>
                  value?.date ? { 'data-date': String(value.date).slice(0, 10) } : {}
                }
                onClick={(value: any) => {
                  if (!value?.date) return;
                  const d = String(value.date).slice(0, 10);
                  setRemarkDialog({ open: true, date: d, existing: remarkMap[d] });
                }}
                onMouseOver={(e: any, value: any) => {
                  if (!value?.date) return;
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setTooltip({
                    visible: true,
                    x: rect.left + window.scrollX,
                    y: rect.top + window.scrollY,
                    data: {
                      date: String(value.date).slice(0, 10),
                      count: value.count ?? 0,
                      revenue: value.revenue ?? 0,
                      remark: value.remark,
                    },
                  });
                }}
                showWeekdayLabels
              />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span>Less</span>
                {['color-empty', 'color-scale-1', 'color-scale-2', 'color-scale-3', 'color-scale-4'].map((c) => (
                  <div key={c} className={`h-3 w-3 rounded-sm react-calendar-heatmap ${c}`} />
                ))}
                <span>More</span>
              </div>
              {/* Remarks list */}
              {Object.keys(remarkMap).length > 0 && (
                <div className="flex flex-wrap gap-2 justify-end">
                  {Object.entries(remarkMap).map(([date, remark]) => (
                    <div key={date} className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded px-2 py-0.5 text-[10px] text-violet-700">
                      <span className="font-medium">{new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      <span>· {remark}</span>
                      <button onClick={() => deleteRemarkMutation.mutate(date)} className="ml-1 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Products + Customer Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-lg font-heading text-gold-500 w-6">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">{p.quantitySold} sold</p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
                {topProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No sales data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Customer Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary p-3 text-center">
                  <p className="text-2xl font-heading font-bold text-gold-500">{customerMetrics?.totalCustomers ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total Customers</p>
                </div>
                <div className="rounded-lg bg-secondary p-3 text-center">
                  <p className="text-2xl font-heading font-bold text-emerald-600">{customerMetrics?.newThisMonth ?? 0}</p>
                  <p className="text-xs text-muted-foreground">New This Month</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Spenders</p>
                {(customerMetrics?.topCustomers ?? []).slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-sm truncate max-w-[60%]">{c.customerName}</p>
                    <span className="text-sm font-medium">{formatCurrency(c.totalSpent)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fixed tooltip */}
      <HeatmapTooltip
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        data={tooltip.data}
      />

      {/* Remark Dialog */}
      <RemarkDialog
        open={remarkDialog.open}
        onClose={() => setRemarkDialog({ open: false, date: null })}
        date={remarkDialog.date}
        existing={remarkDialog.date ? remarkMap[remarkDialog.date] : undefined}
        onSave={(date, remark) => saveRemarkMutation.mutate({ date, remark })}
      />
    </div>
  );
}

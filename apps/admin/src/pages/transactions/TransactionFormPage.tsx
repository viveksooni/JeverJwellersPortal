import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  Plus, Trash2, Loader2, Search, ShoppingCart, ShoppingBag,
  Wrench, ArrowLeftRight, Gem, User, Phone, Mail, MapPin,
  Lock, CalendarIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { TransactionType } from '@jever/shared';

// ─── Schema ──────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productId: z.string().optional(),
  pieceId: z.string().optional(),           // set when selling a specific piece
  productName: z.string().min(1, 'Item name required'),
  metalType: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  weightG: z.string().optional(),
  purity: z.string().optional(),
  ratePerGram: z.string().optional(),
  makingCharge: z.string().optional(),
  makingType: z.enum(['flat', 'per_gram', 'percentage']).default('flat'),
  stoneCharge: z.string().default('0'),
  unitPrice: z.string().default('0'),
  totalPrice: z.string().default('0'),
  isExchangeItem: z.boolean().default(false),
  maxQty: z.coerce.number().optional(),     // UI-only: available stock limit
});

const formSchema = z.object({
  customerId: z.string().optional(),
  discountAmount: z.string().default('0'),
  taxAmount: z.string().default('0'),
  paymentMethod: z.enum(['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'mixed']).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid']).default('unpaid'),
  amountPaid: z.string().default('0'),
  notes: z.string().optional(),
  transactionDate: z.string().optional(),
  items: z.array(itemSchema).default([]),
  repairItemDescription: z.string().optional(),
  repairIssue: z.string().optional(),
  repairType: z.string().optional(),
  repairEstimatedDays: z.coerce.number().optional(),
  repairDeliveryDate: z.string().optional(),
  repairCharge: z.string().optional(),
  repairActualWeightG: z.string().optional(),
  gstEnabled: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  sale: { label: 'New Sale', icon: ShoppingCart, color: 'text-gold-500' },
  purchase: { label: 'New Purchase', icon: ShoppingBag, color: 'text-blue-500' },
  repair: { label: 'New Repair Order', icon: Wrench, color: 'text-violet-500' },
  exchange: { label: 'New Exchange', icon: ArrowLeftRight, color: 'text-emerald-500' },
  custom_order: { label: 'Custom Order', icon: Gem, color: 'text-amber-600' },
};

// Build rate lookup key: gold_24k / gold_22k / gold_18k / silver / silver_925
function getRateKey(metalType?: string | null, purity?: string | null): string | null {
  const mt = metalType?.toLowerCase();
  const p = purity?.toLowerCase().replace(/\s/g, '') ?? '';

  if (mt === 'gold') {
    if (['24k', '22k', '18k'].includes(p)) return `gold_${p}`;
    return null;
  }
  if (mt === 'silver') {
    if (p === '925') return 'silver_925';
    return 'silver'; // plain silver (covers 'silver', 'standard', etc.)
  }
  return null;
}

// ─── Date Picker (single) ──────────────────────────────────────────────────

function DatePicker({ value, onChange, placeholder = 'Pick date', disabled }: {
  value?: string; onChange: (v: string) => void; placeholder?: string; disabled?: (d: Date) => boolean;
}) {
  const date = value ? new Date(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('w-full justify-start gap-2 h-9 font-normal text-sm', !date && 'text-muted-foreground')}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {date ? format(date, 'dd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onChange(format(d, 'yyyy-MM-dd'))}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── New Customer Mini-Form ───────────────────────────────────────────────────

function NewCustomerForm({ prefill, onSave }: {
  prefill: string;
  onSave: (customer: any) => void;
}) {
  const [name, setName] = useState(() => /^\d/.test(prefill) ? '' : prefill);
  const [phone, setPhone] = useState(() => /^\d/.test(prefill) ? prefill : '');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast({ variant: 'destructive', title: 'Name is required' }); return; }
    setSaving(true);
    try {
      const res = await api.post('/customers', { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, address: address.trim() || undefined });
      toast({ variant: 'success', title: 'Customer created!' });
      onSave(res.data.data);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to create customer' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-gold-200 bg-gold-50 p-4 space-y-3">
      <p className="text-xs font-semibold text-gold-700 uppercase tracking-wider">New Customer Details</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@example.com" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="City / area" className="h-8 text-sm" />
        </div>
      </div>
      <Button type="button" size="sm" variant="gold" onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : <><Plus className="h-3 w-3" /> Save & Select Customer</>}
      </Button>
    </div>
  );
}

// ─── Customer Section ─────────────────────────────────────────────────────────

function CustomerSection({ setValue }: { setValue: any }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: results = [] } = useQuery({
    queryKey: ['customer-search', q],
    queryFn: () => q.length >= 2
      ? api.get(`/customers?search=${q}&limit=8`).then((r) => r.data.data)
      : Promise.resolve([]),
    enabled: q.length >= 2,
  });

  function select(c: any) {
    setSelected(c);
    setValue('customerId', c.id);
    setOpen(false);
    setQ('');
    setShowNewForm(false);
  }

  function clear() {
    setSelected(null);
    setValue('customerId', undefined);
    setQ('');
    setShowNewForm(false);
  }

  if (selected) {
    return (
      <div className="rounded-lg bg-secondary px-4 py-3 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="font-medium">{selected.name}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {selected.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selected.phone}</span>}
            {selected.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selected.email}</span>}
            {selected.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selected.address}</span>}
          </div>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={clear} className="shrink-0">Change</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone…"
          className="pl-9"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setShowNewForm(false); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
      </div>

      {open && q.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-lg max-h-52 overflow-y-auto">
          {(results as any[]).map((c: any) => (
            <button
              key={c.id}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent text-sm"
              onMouseDown={() => select(c)}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700 text-xs font-bold">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.phone ?? 'No phone'} {c.email ? `· ${c.email}` : ''}</p>
              </div>
            </button>
          ))}

          {/* No results → offer to create */}
          {(results as any[]).length === 0 && !showNewForm && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent text-sm text-gold-600 font-medium"
              onMouseDown={() => { setOpen(false); setShowNewForm(true); }}
            >
              <Plus className="h-4 w-4" /> Add new customer "{q}"
            </button>
          )}
        </div>
      )}

      {showNewForm && (
        <NewCustomerForm prefill={q} onSave={select} />
      )}

      {!showNewForm && (
        <p className="text-xs text-muted-foreground mt-1.5">Leave blank for walk-in customer</p>
      )}
    </div>
  );
}

// ─── Enhanced Product Search ──────────────────────────────────────────────────

function ProductSearchInput({ todayRates, onSelect, selectedProductIds = new Set() }: {
  todayRates: Record<string, string>;
  onSelect: (product: any, rate: string | null) => void;
  selectedProductIds?: Set<string>;
}) {
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [metalType, setMetalType] = useState('all');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
    staleTime: 300_000,
  });

  const { data: metalTypes = [] } = useQuery({
    queryKey: ['metal-types'],
    queryFn: () => api.get('/settings/metal-types').then((r) => r.data.data),
    staleTime: 300_000,
  });

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['product-search-all', q, categoryId, metalType],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' });
      if (q.length >= 1) params.set('search', q);
      if (categoryId !== 'all') params.set('categoryId', categoryId);
      if (metalType !== 'all') params.set('metalType', metalType);
      return api.get(`/products?${params}`).then((r) => r.data.data ?? []);
    },
    staleTime: 60_000,
  });

  const hasActiveFilters = categoryId !== 'all' || metalType !== 'all' || q.length >= 1;

  return (
    <div className="space-y-3">
      {/* ── Filter / search bar ── */}
      <div className="flex flex-wrap gap-2">
        {/* Category tabs as a Select */}
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-36 h-8 text-xs shrink-0">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(categories as any[]).map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={metalType} onValueChange={setMetalType}>
          <SelectTrigger className="w-28 h-8 text-xs shrink-0">
            <SelectValue placeholder="Metal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Metals</SelectItem>
            {(metalTypes as any[]).map((m: any) => (
              <SelectItem key={m.name} value={m.name}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Text search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or SKU…"
            className="pl-9 h-8 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => { setCategoryId('all'); setMetalType('all'); setQ(''); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* ── Always-visible product grid ── */}
      <div className="rounded-md border border-border bg-background max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading products…
          </div>
        ) : (results as any[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground gap-1">
            <Gem className="h-6 w-6 opacity-40" />
            <span>No products found.</span>
            {hasActiveFilters && (
              <button
                type="button"
                className="text-gold-600 hover:underline text-xs mt-0.5"
                onClick={() => { setCategoryId('all'); setMetalType('all'); setQ(''); }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(results as any[]).map((p: any) => {
              const rateKey = getRateKey(p.metalType, p.purity);
              const rate = rateKey ? (todayRates[rateKey] ?? null) : null;
              const stock = p.inventory?.quantity ?? 0;
              const outOfStock = stock === 0;
              const isSelected = selectedProductIds.has(String(p.id));
              const stockColor = outOfStock
                ? 'text-red-500'
                : stock <= 2
                ? 'text-amber-500'
                : 'text-emerald-600';

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p, rate)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-none',
                    isSelected
                      ? 'bg-gold-50 border-l-2 border-gold-500 hover:bg-gold-100'
                      : 'hover:bg-accent',
                    outOfStock && 'opacity-60',
                  )}
                >
                  {/* Thumbnail */}
                  <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-secondary flex items-center justify-center">
                    {p.images?.[0] ? (
                      <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Gem className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate leading-tight">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.sku && (
                        <span className="font-mono text-[10px] font-bold text-gold-600">{p.sku}</span>
                      )}
                      {p.purity && (
                        <span className="text-[10px] text-muted-foreground uppercase">{p.purity}</span>
                      )}
                      {p.metalType && (
                        <span className="text-[10px] text-muted-foreground capitalize">{p.metalType}</span>
                      )}
                    </div>
                  </div>

                  {/* Stock + weight + selected indicator */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                    {isSelected && (
                      <span className="text-[10px] font-semibold text-gold-600 bg-gold-100 px-1.5 py-0.5 rounded-full">
                        Added
                      </span>
                    )}
                    <span className={cn('text-xs font-semibold', stockColor)}>
                      {outOfStock ? 'Out of stock' : `${stock} in stock`}
                    </span>
                    {p.grossWeightG && (
                      <p className="text-[10px] text-muted-foreground">{parseFloat(p.grossWeightG).toFixed(3)}g</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Row count hint */}
      {!isLoading && (results as any[]).length > 0 && (
        <p className="text-[11px] text-muted-foreground text-right pr-0.5">
          {(results as any[]).length} product{(results as any[]).length !== 1 ? 's' : ''}
          {hasActiveFilters ? ' matched' : ' total'}
        </p>
      )}
    </div>
  );
}

// ─── Line Item Row ────────────────────────────────────────────────────────────

function LineItemRow({ index, register, watch, setValue, remove, isExchange, todayRates }: {
  index: number; register: any; watch: any; setValue: any;
  remove: () => void; isExchange: boolean; todayRates: Record<string, string>;
}) {
  const qty        = parseFloat(watch(`items.${index}.quantity`) || '1');
  const weight     = parseFloat(watch(`items.${index}.weightG`) || '0');
  const purity     = watch(`items.${index}.purity`) || '';
  const metalType  = watch(`items.${index}.metalType`) || '';
  const stone      = parseFloat(watch(`items.${index}.stoneCharge`) || '0');
  const makingRaw  = parseFloat(watch(`items.${index}.makingCharge`) || '0');
  const makingType = watch(`items.${index}.makingType`) || 'flat';
  const maxQty     = watch(`items.${index}.maxQty`) as number | undefined;
  const stockLimit = (maxQty !== undefined && maxQty > 0) ? maxQty : undefined;
  const atMaxStock = stockLimit !== undefined && qty >= stockLimit;

  // Rate locked from central rates
  const rateKey = getRateKey(metalType || null, purity || null);
  const lockedRate = rateKey ? parseFloat(todayRates[rateKey] ?? '0') : 0;
  const rateDisplay = watch(`items.${index}.ratePerGram`) || '';

  // Compute making value based on type
  const metalPrice = lockedRate > 0 && weight > 0 ? lockedRate * weight : 0;
  const makingValue =
    makingType === 'per_gram' ? makingRaw * weight :
    makingType === 'percentage' ? (metalPrice * makingRaw) / 100 :
    makingRaw; // flat

  // Auto-calculate totals
  useEffect(() => {
    const unitPrice = metalPrice + makingValue + stone;
    const total = unitPrice * qty;
    setValue(`items.${index}.unitPrice`, unitPrice.toFixed(2));
    setValue(`items.${index}.totalPrice`, total.toFixed(2));
    if (lockedRate > 0) setValue(`items.${index}.ratePerGram`, lockedRate.toFixed(2));
  }, [qty, weight, lockedRate, makingRaw, makingType, stone]);

  const totalPrice = watch(`items.${index}.totalPrice`) || '0';
  const metalPrice$ = metalPrice;
  const makingValue$ = makingValue;

  return (
    <div className={`rounded-lg border p-3 space-y-3 ${isExchange ? 'border-emerald-200 bg-emerald-50/60' : 'border-border bg-card'}`}>
      {/* Row header */}
      <div className="flex items-center gap-2">
        {isExchange && <Badge variant="success" className="text-[10px] shrink-0">Exchange In</Badge>}
        <Input
          {...register(`items.${index}.productName`)}
          placeholder="Item name / description"
          className="text-sm flex-1"
        />
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={remove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Qty</Label>
          <Input
            {...register(`items.${index}.quantity`)}
            type="number"
            min="1"
            max={stockLimit}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 1;
              const clamped = stockLimit ? Math.min(val, stockLimit) : val;
              setValue(`items.${index}.quantity`, Math.max(1, clamped));
            }}
            className={cn('text-sm h-8', atMaxStock && 'border-amber-500')}
          />
          {maxQty !== undefined && (
            <p className={cn('text-[10px] mt-0.5',
              maxQty === 0 ? 'text-red-500' :
              atMaxStock ? 'text-amber-600 font-medium' :
              'text-muted-foreground'
            )}>
              {maxQty === 0 ? 'Out of stock' : atMaxStock ? `Max ${maxQty} in stock` : `${maxQty} in stock`}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Metal</Label>
          <Select
            value={metalType || 'gold'}
            onValueChange={(v) => setValue(`items.${index}.metalType`, v)}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Purity</Label>
          <Select
            value={purity || ''}
            onValueChange={(v) => setValue(`items.${index}.purity`, v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {(metalType === 'silver'
                ? [{ v: 'silver', label: 'Silver' }, { v: '925', label: '925' }]
                : [{ v: '24k', label: '24K' }, { v: '22k', label: '22K' }, { v: '18k', label: '18K' }]
              ).map(({ v, label }) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Weight (g)</Label>
          <Input {...register(`items.${index}.weightG`)} placeholder="12.500" className="text-sm h-8" />
        </div>

        {/* Rate — locked from central rates */}
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            Rate/g <Lock className="h-2.5 w-2.5 text-muted-foreground" />
          </Label>
          <div className="relative">
            <Input
              value={lockedRate > 0 ? `₹${lockedRate.toLocaleString('en-IN')}` : rateDisplay ? `₹${rateDisplay}` : '—'}
              readOnly
              className="text-sm h-8 bg-secondary cursor-not-allowed text-muted-foreground pr-2"
            />
          </div>
        </div>

        {/* Making charge + type */}
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Making Charge</Label>
          <div className="flex gap-1">
            <Input {...register(`items.${index}.makingCharge`)} placeholder="0" className="text-sm h-8 flex-1" />
            <Select
              value={makingType}
              onValueChange={(v) => setValue(`items.${index}.makingType`, v)}
            >
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">₹ Flat</SelectItem>
                <SelectItem value="per_gram">₹/g</SelectItem>
                <SelectItem value="percentage">% of metal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Stone (₹)</Label>
          <Input {...register(`items.${index}.stoneCharge`)} placeholder="0" className="text-sm h-8" />
        </div>
      </div>

      {/* Price breakdown */}
      <div className="flex items-center justify-between bg-secondary/60 rounded px-3 py-1.5 text-xs text-muted-foreground">
        <span>
          Metal {formatCurrency(metalPrice$.toFixed(2))}
          {makingValue$ > 0 && ` + Making ${formatCurrency(makingValue$.toFixed(2))}`}
          {stone > 0 && ` + Stone ${formatCurrency(stone.toFixed(2))}`}
        </span>
        <span className="font-semibold text-gold-600 text-sm">
          {formatCurrency(totalPrice)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function TransactionFormPage() {
  const { type = 'sale' } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const meta = TYPE_META[type] ?? TYPE_META.sale;
  const isRepair = type === 'repair';
  const isExchange = type === 'exchange';

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      items: [],
      discountAmount: '0',
      taxAmount: '0',
      amountPaid: '0',
      paymentStatus: 'unpaid',
      gstEnabled: false,
      transactionDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Today's rates (locked)
  const { data: todayRates = {} } = useQuery<Record<string, string>>({
    queryKey: ['rates', 'today'],
    queryFn: () => api.get('/rates/today').then((r) => r.data.data),
    staleTime: 60_000,
  });

  // Totals
  const items = watch('items');
  const discount = parseFloat(watch('discountAmount') || '0');
  const taxAmount = parseFloat(watch('taxAmount') || '0');
  const gstEnabled = watch('gstEnabled');
  const transactionDate = watch('transactionDate');
  const repairDeliveryDate = watch('repairDeliveryDate');
  const paymentStatus = watch('paymentStatus');

  const subtotal = items.reduce((s, item) => s + parseFloat(item.totalPrice || '0'), 0);
  const finalAmount = subtotal - discount + taxAmount;

  // When fully paid, auto-fill amountPaid with the total
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setValue('amountPaid', finalAmount.toFixed(2));
    }
  }, [paymentStatus, finalAmount, setValue]);

  // Add product from search
  const handleProductSelect = useCallback((product: any, rate: string | null) => {
    const weight = product.grossWeightG ?? '';
    const metalT = (product.metalType ?? '').toLowerCase();
    const defaultMakingType = metalT === 'gold' ? 'percentage' : metalT === 'silver' ? 'per_gram' : 'flat';
    const defaultMakingCharge = metalT === 'gold' ? '18' : '0';
    const makingType: 'flat' | 'per_gram' | 'percentage' = product.makingType ?? defaultMakingType;
    const makingRaw = parseFloat(product.makingCharge && parseFloat(product.makingCharge) !== 0 ? product.makingCharge : defaultMakingCharge);
    const metalPrice = rate && weight ? parseFloat(rate) * parseFloat(weight) : 0;
    const makingValue =
      makingType === 'per_gram' ? makingRaw * parseFloat(weight || '0') :
      makingType === 'percentage' ? (metalPrice * makingRaw) / 100 : makingRaw;
    const unitPrice = metalPrice + makingValue;

    append({
      productId: product.id,
      productName: product.name,
      metalType: product.metalType ?? '',
      quantity: 1,
      purity: product.purity ?? '',
      weightG: String(weight),
      ratePerGram: rate ? String(parseFloat(rate)) : '',
      makingCharge: String(makingRaw),
      makingType,
      stoneCharge: product.stoneCharge ?? '0',
      unitPrice: unitPrice.toFixed(2),
      totalPrice: unitPrice.toFixed(2),
      isExchangeItem: false,
      maxQty: product.inventory?.quantity ?? undefined,
    });
  }, [append, type]);

  const addEmptyItem = (isExchangeItem = false) => append({
    productId: undefined, productName: '', metalType: 'gold', quantity: 1,
    purity: '', weightG: '', ratePerGram: '', makingCharge: '18', makingType: 'percentage',
    stoneCharge: '0', unitPrice: '0', totalPrice: '0', isExchangeItem,
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: any = {
        type,
        customerId: values.customerId,
        totalAmount: subtotal.toFixed(2),
        discountAmount: values.discountAmount,
        taxAmount: values.taxAmount,
        finalAmount: finalAmount.toFixed(2),
        paymentMethod: values.paymentMethod,
        paymentStatus: values.paymentStatus,
        amountPaid: values.amountPaid,
        notes: values.notes,
        goldRate: (todayRates as any)['gold_22k'] ?? null,
        silverRate: (todayRates as any)['silver_999'] ?? null,
        transactionDate: values.transactionDate,
        items: values.items,
      };

      if (isRepair) {
        payload.repairOrder = {
          itemDescription: values.repairItemDescription ?? '',
          issueDescribed: values.repairIssue,
          repairType: values.repairType,
          estimatedDays: values.repairEstimatedDays,
          deliveryDate: values.repairDeliveryDate,
          repairCharge: values.repairCharge,
          actualWeightG: values.repairActualWeightG,
        };
      }

      const txnRes = await api.post('/transactions', payload);
      const txnId = txnRes.data.data.id;

      if (type === 'sale' || type === 'custom_order') {
        await api.post('/invoices', { transactionId: txnId, gstEnabled: values.gstEnabled }).catch(() => {});
      }

      return txnRes.data.data;
    },
    onSuccess: (txn) => {
      toast({ variant: 'success', title: 'Transaction created!', description: txn.transactionNo });
      navigate(`/transactions/${txn.id}`);
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Failed', description: err.response?.data?.error ?? 'Unknown error' });
    },
  });

  return (
    <div>
      <PageHeader title={meta.label} description={`Type: ${type.replace('_', ' ')}`} />

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Customer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" /> Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <CustomerSection setValue={setValue} />
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-sm">Items / Products</CardTitle>
                <div className="flex gap-2">
                  {isExchange && (
                    <Button type="button" size="sm" variant="outline" onClick={() => addEmptyItem(true)}
                      className="text-xs h-8 text-emerald-700 border-emerald-300">
                      + Exchange Item
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => addEmptyItem(false)} className="text-xs h-8">
                    + Manual Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 relative">
                {!isRepair && (
                  <ProductSearchInput
                    todayRates={todayRates as Record<string, string>}
                    onSelect={handleProductSelect}
                    selectedProductIds={new Set(items.filter(i => i.productId).map(i => String(i.productId)))}
                  />
                )}

                {fields.length === 0 && !isRepair && (
                  <div className="rounded-lg border-2 border-dashed border-border py-6 text-center text-muted-foreground text-sm space-y-1">
                    <p>Search for a product above, or click <strong>+ Manual Item</strong> to add a custom line</p>
                    <p className="text-xs">Manual items are not linked to inventory — use them for one-off or unlisted items</p>
                  </div>
                )}

                {fields.map((field, index) => (
                  <LineItemRow
                    key={field.id}
                    index={index}
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    remove={() => remove(index)}
                    isExchange={watch(`items.${index}.isExchangeItem`)}
                    todayRates={todayRates as Record<string, string>}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Repair-specific fields */}
            {isRepair && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Repair Details</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Item Description *</Label>
                    <Input {...register('repairItemDescription')} placeholder="e.g. Gold necklace chain repair" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Issue Described by Customer</Label>
                    <Textarea {...register('repairIssue')} placeholder="Describe the issue…" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Repair Type</Label>
                      <Input {...register('repairType')} placeholder="Resizing, polishing…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Actual Weight (g)</Label>
                      <Input {...register('repairActualWeightG')} placeholder="12.500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Estimated Days</Label>
                      <Input {...register('repairEstimatedDays')} type="number" placeholder="3" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Expected Delivery</Label>
                      <DatePicker
                        value={repairDeliveryDate}
                        onChange={(d) => setValue('repairDeliveryDate', d)}
                        placeholder="Pick delivery date"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Repair Charge (₹)</Label>
                      <Input {...register('repairCharge')} placeholder="500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">

            {/* Today's central rates (read-only info) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> Central Rates (Today)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(todayRates).length === 0 && (
                  <p className="text-xs text-muted-foreground">No rates configured. Set them in Settings → Metal Rates.</p>
                )}
                {(Object.entries(todayRates) as [string, string][])
                  .filter(([, v]) => v)
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="font-semibold">₹{parseFloat(val).toLocaleString('en-IN')}/g</span>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Order Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal.toFixed(2))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm flex-1">Discount (₹)</span>
                    <Input {...register('discountAmount')} className="w-24 h-7 text-right text-sm" placeholder="0" />
                  </div>

                  {/* GST toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <Label className="text-sm cursor-pointer">Include GST (3%)</Label>
                    <Switch
                      checked={gstEnabled}
                      onCheckedChange={(v) => {
                        setValue('gstEnabled', v);
                        setValue('taxAmount', v ? ((subtotal - discount) * 0.03).toFixed(2) : '0');
                      }}
                    />
                  </div>
                  {gstEnabled && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex-1">GST (3% on ₹{(subtotal - discount).toFixed(0)})</span>
                      <span className="font-semibold text-foreground">₹{((subtotal - discount) * 0.03).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-border pt-2 flex justify-between font-semibold text-base">
                    <span>Total</span>
                    <span className="text-gold-600 font-heading">{formatCurrency(finalAmount.toFixed(2))}</span>
                  </div>
                </div>

                {/* Payment */}
                <div className="pt-2 space-y-3 border-t border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Payment Method</Label>
                    <Select onValueChange={(v) => setValue('paymentMethod', v as any)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select method" /></SelectTrigger>
                      <SelectContent>
                        {['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'mixed'].map((m) => (
                          <SelectItem key={m} value={m} className="capitalize">{m.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Payment Status</Label>
                    <Select defaultValue="unpaid" onValueChange={(v) => setValue('paymentStatus', v as any)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid in Full</SelectItem>
                        <SelectItem value="partial">Partial Payment</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount Paid (₹)</Label>
                    <Input
                      {...register('amountPaid')}
                      placeholder="0.00"
                      className={cn('h-9 text-sm', paymentStatus === 'paid' && 'bg-secondary cursor-not-allowed text-muted-foreground')}
                      disabled={paymentStatus === 'paid'}
                      readOnly={paymentStatus === 'paid'}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Date & Notes */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Transaction Date</Label>
                  <DatePicker
                    value={transactionDate}
                    onChange={(d) => setValue('transactionDate', d)}
                    placeholder="Pick transaction date"
                    disabled={(d) => d > new Date()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea {...register('notes')} placeholder="Any remarks…" rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button type="submit" variant="gold" className="w-full" size="lg" disabled={mutation.isPending}>
              {mutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                : `Create ${meta.label}`}
            </Button>
          </div>
        </div>
      </form>

    </div>
  );
}

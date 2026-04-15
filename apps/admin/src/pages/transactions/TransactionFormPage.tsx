import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Trash2, Loader2, Search, ChevronDown, ChevronUp, UserPlus,
  ShoppingCart, ShoppingBag, Wrench, ArrowLeftRight, Gem,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { TransactionType } from '@jever/shared';

// ─── Schema ──────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, 'Item name required'),
  quantity: z.coerce.number().int().min(1).default(1),
  weightG: z.string().optional(),
  purity: z.string().optional(),
  ratePerGram: z.string().optional(),
  makingCharge: z.string().optional(),
  stoneCharge: z.string().default('0'),
  unitPrice: z.string().default('0'),
  totalPrice: z.string().default('0'),
  isExchangeItem: z.boolean().default(false),
});

const formSchema = z.object({
  customerId: z.string().optional(),
  goldRate: z.string().optional(),
  silverRate: z.string().optional(),
  discountAmount: z.string().default('0'),
  taxAmount: z.string().default('0'),
  paymentMethod: z.enum(['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'mixed']).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid']).default('unpaid'),
  amountPaid: z.string().default('0'),
  notes: z.string().optional(),
  transactionDate: z.string().optional(),
  items: z.array(itemSchema).default([]),
  // Repair-specific
  repairItemDescription: z.string().optional(),
  repairIssue: z.string().optional(),
  repairType: z.string().optional(),
  repairEstimatedDays: z.coerce.number().optional(),
  repairDeliveryDate: z.string().optional(),
  repairCharge: z.string().optional(),
  repairActualWeightG: z.string().optional(),
  // Invoice GST
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

// ─── Product Search Dropdown ──────────────────────────────────────────────────

function ProductSearchInput({
  onSelect,
}: {
  onSelect: (product: any, rate: any) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['product-search', q],
    queryFn: () =>
      q.length >= 2
        ? api.get(`/products?search=${q}&limit=10`).then((r) => r.data.data)
        : Promise.resolve([]),
    enabled: q.length >= 2,
  });

  const { data: todayRates = {} } = useQuery({
    queryKey: ['rates', 'today'],
    queryFn: () => api.get('/rates/today').then((r) => r.data.data),
    staleTime: 60_000,
  });

  const results: any[] = data ?? [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search & add product…"
          className="pl-9"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {results.map((p: any) => {
            const rateKey = p.metalType && p.purity
              ? `${p.metalType}_${p.purity.toLowerCase().replace('k', 'k')}`
              : null;
            const rate = rateKey ? (todayRates as any)[rateKey] : null;
            return (
              <button
                key={p.id}
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent text-sm"
                onMouseDown={() => {
                  onSelect(p, { todayRates, rateKey, rate });
                  setQ('');
                  setOpen(false);
                }}
              >
                {p.images?.[0] && (
                  <img src={p.images[0].url} alt="" className="h-8 w-8 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.purity && `${p.purity} · `}
                    {p.grossWeightG && `${p.grossWeightG}g · `}
                    Stock: {p.inventory?.quantity ?? 0}
                  </p>
                </div>
                {rate && <span className="text-xs text-gold-600">₹{parseFloat(rate).toLocaleString('en-IN')}/g</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Line Item Row ────────────────────────────────────────────────────────────

function LineItemRow({
  index,
  register,
  watch,
  setValue,
  remove,
  isExchange,
}: {
  index: number;
  register: any;
  watch: any;
  setValue: any;
  remove: () => void;
  isExchange: boolean;
}) {
  const qty = parseFloat(watch(`items.${index}.quantity`) || '1');
  const weight = parseFloat(watch(`items.${index}.weightG`) || '0');
  const rate = parseFloat(watch(`items.${index}.ratePerGram`) || '0');
  const making = parseFloat(watch(`items.${index}.makingCharge`) || '0');
  const stone = parseFloat(watch(`items.${index}.stoneCharge`) || '0');

  // Auto-calculate unit price
  useEffect(() => {
    let price = 0;
    if (rate && weight) {
      price = weight * rate + making + stone;
    } else {
      price = making + stone;
    }
    const total = price * qty;
    setValue(`items.${index}.unitPrice`, price.toFixed(2));
    setValue(`items.${index}.totalPrice`, total.toFixed(2));
  }, [qty, weight, rate, making, stone]);

  const totalPrice = watch(`items.${index}.totalPrice`) || '0';

  return (
    <div className={`rounded-lg border p-3 space-y-3 ${isExchange ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2">
        {isExchange && <Badge variant="success" className="text-[10px]">Exchange In</Badge>}
        <div className="flex-1">
          <Input
            {...register(`items.${index}.productName`)}
            placeholder="Item name / description"
            className="text-sm"
          />
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={remove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Qty</Label>
          <Input {...register(`items.${index}.quantity`)} type="number" min="1" className="text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Purity</Label>
          <Input {...register(`items.${index}.purity`)} placeholder="22K" className="text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Weight (g)</Label>
          <Input {...register(`items.${index}.weightG`)} placeholder="12.500" className="text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rate/g (₹)</Label>
          <Input {...register(`items.${index}.ratePerGram`)} placeholder="6233" className="text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Making (₹)</Label>
          <Input {...register(`items.${index}.makingCharge`)} placeholder="500" className="text-sm h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stone (₹)</Label>
          <Input {...register(`items.${index}.stoneCharge`)} placeholder="0" className="text-sm h-8" />
        </div>
      </div>
      <div className="flex justify-end">
        <p className="text-sm font-semibold text-gold-600">
          Item Total: {formatCurrency(totalPrice)}
        </p>
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
      transactionDate: new Date().toISOString().slice(0, 16),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Customer search
  const [customerQ, setCustomerQ] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const { data: customerResults = [] } = useQuery({
    queryKey: ['customer-search', customerQ],
    queryFn: () =>
      customerQ.length >= 2
        ? api.get(`/customers?search=${customerQ}&limit=8`).then((r) => r.data.data)
        : Promise.resolve([]),
    enabled: customerQ.length >= 2,
  });
  const [customerOpen, setCustomerOpen] = useState(false);

  // Today's rates
  const { data: todayRates = {} } = useQuery({
    queryKey: ['rates', 'today'],
    queryFn: () => api.get('/rates/today').then((r) => r.data.data),
    staleTime: 60_000,
  });

  // Totals
  const items = watch('items');
  const discount = parseFloat(watch('discountAmount') || '0');
  const taxAmount = parseFloat(watch('taxAmount') || '0');
  const gstEnabled = watch('gstEnabled');

  const subtotal = items.reduce((s, item) => s + parseFloat(item.totalPrice || '0'), 0);
  const finalAmount = subtotal - discount + taxAmount;

  // Add product from search
  const handleProductSelect = useCallback((product: any, rateInfo: any) => {
    const rate = rateInfo?.rate ?? '';
    const weight = product.grossWeightG ?? '';
    const making = product.makingCharge ?? '0';
    const makingType = product.makingType ?? 'flat';
    let makingValue = parseFloat(making);
    if (makingType === 'per_gram' && weight) makingValue = makingValue * parseFloat(weight);

    const metalPrice = rate && weight ? parseFloat(rate) * parseFloat(weight) : 0;
    const unitPrice = metalPrice + makingValue;

    append({
      productId: product.id,
      productName: product.name,
      quantity: 1,
      purity: product.purity ?? '',
      weightG: product.grossWeightG ?? '',
      ratePerGram: rate ? String(parseFloat(rate)) : '',
      makingCharge: makingValue ? String(makingValue.toFixed(2)) : '',
      stoneCharge: '0',
      unitPrice: unitPrice.toFixed(2),
      totalPrice: unitPrice.toFixed(2),
      isExchangeItem: false,
    });
  }, [append]);

  const addEmptyItem = (isExchangeItem = false) => {
    append({
      productId: undefined,
      productName: '',
      quantity: 1,
      purity: '',
      weightG: '',
      ratePerGram: '',
      makingCharge: '',
      stoneCharge: '0',
      unitPrice: '0',
      totalPrice: '0',
      isExchangeItem,
    });
  };

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: any = {
        type,
        customerId: selectedCustomer?.id,
        totalAmount: subtotal.toFixed(2),
        discountAmount: values.discountAmount,
        taxAmount: values.taxAmount,
        finalAmount: finalAmount.toFixed(2),
        paymentMethod: values.paymentMethod,
        paymentStatus: values.paymentStatus,
        amountPaid: values.amountPaid,
        notes: values.notes,
        goldRate: (todayRates as any)['gold_22k'] ?? values.goldRate,
        silverRate: (todayRates as any)['silver_999'] ?? values.silverRate,
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

      // Auto-generate invoice for sales
      if (type === 'sale' || type === 'custom_order') {
        await api.post('/invoices', {
          transactionId: txnId,
          gstEnabled: values.gstEnabled,
        }).catch(() => {}); // Non-blocking
      }

      return txnRes.data.data;
    },
    onSuccess: (txn) => {
      toast({ variant: 'success', title: 'Transaction created!', description: txn.transactionNo });
      navigate(`/transactions/${txn.id}`);
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create transaction',
        description: err.response?.data?.error ?? 'Unknown error',
      });
    },
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={meta.label}
        description={`Type: ${type.replace('_', ' ')}`}
      />

      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="flex-1 overflow-y-auto p-6 space-y-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Customer */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
              <CardContent>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
                    <div>
                      <p className="font-medium">{selectedCustomer.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setSelectedCustomer(null); setCustomerQ(''); }}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search customer by name or phone…"
                        className="pl-9"
                        value={customerQ}
                        onChange={(e) => { setCustomerQ(e.target.value); setCustomerOpen(true); }}
                        onFocus={() => setCustomerOpen(true)}
                        onBlur={() => setTimeout(() => setCustomerOpen(false), 150)}
                      />
                    </div>
                    {customerOpen && customerQ.length >= 2 && (
                      <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                        {(customerResults as any[]).map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent text-sm"
                            onMouseDown={() => { setSelectedCustomer(c); setValue('customerId', c.id); setCustomerOpen(false); setCustomerQ(''); }}
                          >
                            <div>
                              <p className="font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.phone}</p>
                            </div>
                          </button>
                        ))}
                        {/* ✅ Create new customer option when no results */}
                        {(customerResults as any[]).length === 0 && (
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent text-sm text-gold-600 font-medium"
                            onMouseDown={async () => {
                              try {
                                // Check if it looks like a phone number
                                const isPhone = /^\d{10}$/.test(customerQ.replace(/\s/g, ''));
                                const payload = isPhone
                                  ? { name: `Customer (${customerQ})`, phone: customerQ }
                                  : { name: customerQ };
                                const res = await import('@/lib/api').then(m => m.default.post('/customers', payload));
                                const newCust = res.data.data;
                                setSelectedCustomer(newCust);
                                setValue('customerId', newCust.id);
                                setCustomerOpen(false);
                                setCustomerQ('');
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            <Plus className="h-4 w-4" /> Create new: <em>"{customerQ}"</em>
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">Type name or mobile — leave blank for walk-in</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-sm">Items / Products</CardTitle>
                <div className="flex gap-2">
                  {isExchange && (
                    <Button type="button" size="sm" variant="outline" onClick={() => addEmptyItem(true)} className="text-xs h-8 text-emerald-700 border-emerald-300">
                      + Exchange Item
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => addEmptyItem(false)} className="text-xs h-8">
                    + Manual Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isRepair && (
                  <ProductSearchInput onSelect={handleProductSelect} />
                )}

                {fields.length === 0 && !isRepair && (
                  <div className="rounded-lg border-2 border-dashed border-border py-8 text-center text-muted-foreground text-sm">
                    Search or add items above
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
                      <Input {...register('repairDeliveryDate')} type="date" />
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

          {/* ── Right column — Summary & Payment ── */}
          <div className="space-y-5">
            {/* Today's rates */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Today's Rates</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {(Object.entries(todayRates) as [string, string | null][])
                  .filter(([, v]) => v !== null)
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{key.replace('_', ' ').toUpperCase()}</span>
                      <span className="font-medium">₹{parseFloat(val!).toLocaleString('en-IN')}/g</span>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* Totals */}
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
                    <Label className="text-sm cursor-pointer">Include GST</Label>
                    <Switch
                      checked={gstEnabled}
                      onCheckedChange={(v) => {
                        setValue('gstEnabled', v);
                        if (v) {
                          const gst = subtotal * 0.03;
                          setValue('taxAmount', gst.toFixed(2));
                        } else {
                          setValue('taxAmount', '0');
                        }
                      }}
                    />
                  </div>
                  {gstEnabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm flex-1">GST Amount (₹)</span>
                      <Input {...register('taxAmount')} className="w-24 h-7 text-right text-sm" />
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
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select method" /></SelectTrigger>
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
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid in Full</SelectItem>
                        <SelectItem value="partial">Partial Payment</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount Paid (₹)</Label>
                    <Input {...register('amountPaid')} placeholder="0.00" className="h-9" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes + Date */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Transaction Date</Label>
                  <Input {...register('transactionDate')} type="datetime-local" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea {...register('notes')} placeholder="Any remarks…" rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              type="submit"
              variant="gold"
              className="w-full"
              size="lg"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                `Create ${meta.label}`
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

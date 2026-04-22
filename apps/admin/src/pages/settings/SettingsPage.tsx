import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Upload, Loader2, Calendar, Pencil, X, Check, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Tab navigation ───────────────────────────────────────────────────────────

const TABS = ['Shop', 'Metal Rates', 'Catalog'] as const;
type Tab = typeof TABS[number];

const SLUG_TO_TAB: Record<string, Tab> = {
  shop: 'Shop',
  rates: 'Metal Rates',
  catalog: 'Catalog',
};

const TAB_TO_SLUG: Record<Tab, string> = {
  Shop: 'shop',
  'Metal Rates': 'rates',
  Catalog: 'catalog',
};

// ─── Shop Settings ────────────────────────────────────────────────────────────

function ShopSettingsForm() {
  const qc = useQueryClient();
  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data.data),
  });

  const { register, handleSubmit } = useForm({ values: settings });
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => api.patch('/settings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ variant: 'success', title: 'Settings saved' });
    },
  });

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ variant: 'success', title: 'Logo uploaded' });
    } catch {
      toast({ variant: 'destructive', title: 'Logo upload failed' });
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Shop Information</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full border-2 border-dashed border-gold-300 flex items-center justify-center overflow-hidden bg-secondary">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-gold-500 font-heading font-bold text-2xl">J</span>
              )}
            </div>
            <div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={logoUploading}>
                {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload Logo
              </Button>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP · Max 5MB</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Shop Name</Label>
              <Input {...register('shop_name')} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Address</Label>
              <Input {...register('shop_address')} placeholder="Full shop address" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register('shop_phone')} placeholder="+91 XXXXX XXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register('shop_email')} type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input {...register('shop_gstin')} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="space-y-1.5">
              <Label>Invoice Prefix</Label>
              <Input {...register('invoice_prefix')} placeholder="INV" />
            </div>
            <div className="space-y-1.5">
              <Label>CGST Rate (%)</Label>
              <Input {...register('cgst_rate')} placeholder="1.5" />
            </div>
            <div className="space-y-1.5">
              <Label>SGST Rate (%)</Label>
              <Input {...register('sgst_rate')} placeholder="1.5" />
            </div>
          </div>
          <Button type="submit" variant="gold" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Metal Rates ──────────────────────────────────────────────────────────────

function MetalRatesSection() {
  const qc = useQueryClient();
  const [metal, setMetal] = useState<string>('');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showManage, setShowManage] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  // Fetch all rate types dynamically
  const { data: rateTypes = [] } = useQuery<Array<{ key: string; label: string; isDefault: boolean }>>({
    queryKey: ['rates', 'types'],
    queryFn: () => api.get('/rates/types').then((r) => r.data.data),
  });

  // Set default metal once types load
  const effectiveMetal = metal || rateTypes[0]?.key || '';

  const { data: todayRates = {} } = useQuery({
    queryKey: ['rates', 'today'],
    queryFn: () => api.get('/rates/today').then((r) => r.data.data),
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ['rates', 'upcoming'],
    queryFn: () => api.get('/rates/upcoming').then((r) => r.data.data),
  });

  const labelMap = Object.fromEntries(rateTypes.map((t) => [t.key, t.label]));

  const mutation = useMutation({
    mutationFn: () => api.post('/rates', { metalType: effectiveMetal, ratePerGram: rate, effectiveDate: date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rates'] });
      setRate('');
      toast({ variant: 'success', title: 'Rate saved' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/rates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rates'] }),
  });

  // Add custom rate type
  const addTypeMutation = useMutation({
    mutationFn: () => api.post('/rates/types', { key: newKey.toLowerCase().replace(/\s+/g, '_'), label: newLabel || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rates', 'types'] });
      qc.invalidateQueries({ queryKey: ['rates', 'today'] });
      setNewKey('');
      setNewLabel('');
      toast({ variant: 'success', title: 'Rate type added' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: err?.response?.data?.error ?? 'Failed to add rate type' });
    },
  });

  // Remove custom rate type
  const removeTypeMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/rates/types/${encodeURIComponent(key)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rates', 'types'] });
      qc.invalidateQueries({ queryKey: ['rates', 'today'] });
      toast({ variant: 'success', title: 'Rate type removed' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: err?.response?.data?.error ?? 'Failed to remove rate type' });
    },
  });

  const today = new Date().toISOString().split('T')[0];
  const isFuture = date > today;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Metal Rates</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowManage((v) => !v)}>
          <Settings2 className="h-4 w-4" />
          {showManage ? 'Done' : 'Manage Types'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── Manage Rate Types panel ── */}
        {showManage && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
            <p className="text-sm font-semibold">Manage Rate Types</p>
            <p className="text-xs text-muted-foreground">
              Built-in types (Gold 24K, Silver 999, etc.) cannot be removed. You can add custom types for any metal purity you track.
            </p>
            <div className="space-y-2">
              {rateTypes.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{t.key}</span>
                  </div>
                  {t.isDefault ? (
                    <Badge variant="secondary" className="text-[10px]">Built-in</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeTypeMutation.mutate(t.key)}
                      disabled={removeTypeMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {/* Add new type form */}
            <div className="rounded-md border border-gold-300 bg-gold-50 p-3 space-y-3">
              <p className="text-xs font-semibold">Add New Rate Type</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Key <span className="text-muted-foreground">(e.g. gold_10k)</span></Label>
                  <Input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="gold_10k"
                    className="h-8 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Display Label <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Gold 10K"
                    className="h-8"
                  />
                </div>
              </div>
              <Button
                size="sm"
                variant="gold"
                onClick={() => addTypeMutation.mutate()}
                disabled={!newKey || addTypeMutation.isPending}
              >
                {addTypeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Plus className="h-4 w-4" /> Add Rate Type
              </Button>
            </div>
          </div>
        )}

        {/* ── Today's rates grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {rateTypes.map(({ key, label }) => (
            <div key={key} className="rounded-lg border border-gold-200 bg-gold-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-600">{label}</p>
              <p className="text-lg font-heading font-bold text-foreground mt-1">
                {todayRates[key] ? `₹${parseFloat(todayRates[key]).toLocaleString('en-IN')}` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">per gram</p>
            </div>
          ))}
        </div>

        {/* ── Set / Schedule rate ── */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">
            {isFuture ? (
              <span className="flex items-center gap-1.5 text-blue-700"><Calendar className="h-4 w-4" /> Schedule Future Rate</span>
            ) : 'Update Rate'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Metal</Label>
              <Select value={effectiveMetal} onValueChange={setMetal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rateTypes.map(({ key, label }) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rate (₹/g)</Label>
              <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="6233.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Effective Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={today} />
            </div>
          </div>
          <Button variant={isFuture ? 'outline' : 'gold'} size="sm" onClick={() => mutation.mutate()} disabled={!rate || !effectiveMetal || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isFuture ? '📅 Schedule Rate' : 'Set Rate'}
          </Button>
        </div>

        {/* ── Upcoming / scheduled rates ── */}
        {upcoming.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Scheduled Future Rates</p>
            <div className="space-y-2">
              {upcoming.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                  <span className="font-medium">{labelMap[r.metalType] ?? r.metalType}</span>
                  <span>₹{parseFloat(r.ratePerGram).toLocaleString('en-IN')}/g</span>
                  <Badge variant="info">From {r.effectiveDate}</Badge>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Catalog: Categories ──────────────────────────────────────────────────────

function CategoriesSection() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ name: '', description: '', skuPrefix: '' });
  const [newCat, setNewCat] = useState({ name: '', description: '', skuPrefix: '' });
  const [adding, setAdding] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newCat) => api.post('/categories', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setNewCat({ name: '', description: '', skuPrefix: '' });
      setAdding(false);
      toast({ variant: 'success', title: 'Category added' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add category' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof editValues }) =>
      api.put(`/categories/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setEditingId(null);
      toast({ variant: 'success', title: 'Category updated' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to update' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast({ variant: 'success', title: 'Category removed' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Failed to delete';
      toast({ variant: 'destructive', title: msg });
    },
  });

  function startEdit(cat: any) {
    setEditingId(cat.id);
    setEditValues({ name: cat.name, description: cat.description ?? '', skuPrefix: cat.skuPrefix ?? '' });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Jewelry Categories</CardTitle>
        <Button size="sm" variant="gold" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">
          Categories are jewelry types (Ring, Necklace, etc.). The SKU prefix combines with metal prefix to form the product SKU — e.g. Gold Ring uses prefix <strong>GR</strong>.
        </p>

        <div className="grid grid-cols-[1fr_1fr_80px_72px] gap-2 px-2 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SKU Prefix</span>
          <span />
        </div>

        <div className="space-y-1">
          {categories.map((cat: any) => (
            <div key={cat.id} className="grid grid-cols-[1fr_1fr_80px_72px] gap-2 items-center rounded-md border border-border px-2 py-1.5">
              {editingId === cat.id ? (
                <>
                  <Input value={editValues.name} onChange={(e) => setEditValues(v => ({ ...v, name: e.target.value }))} className="h-7 text-sm" />
                  <Input value={editValues.description} onChange={(e) => setEditValues(v => ({ ...v, description: e.target.value }))} className="h-7 text-sm" placeholder="Description" />
                  <Input value={editValues.skuPrefix} onChange={(e) => setEditValues(v => ({ ...v, skuPrefix: e.target.value.toUpperCase() }))} className="h-7 text-sm font-mono" placeholder="e.g. R" maxLength={10} />
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => updateMutation.mutate({ id: cat.id, data: editValues })} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{cat.description}</span>
                  <span className="text-xs font-mono font-semibold text-gold-700 bg-gold-50 border border-gold-200 rounded px-1.5 py-0.5 w-fit">
                    {cat.skuPrefix || '—'}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(cat)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {adding && (
          <div className="grid grid-cols-[1fr_1fr_80px_72px] gap-2 items-center rounded-md border border-gold-300 bg-gold-50 px-2 py-2">
            <Input value={newCat.name} onChange={(e) => setNewCat(v => ({ ...v, name: e.target.value }))} placeholder="Category name" className="h-7 text-sm" autoFocus />
            <Input value={newCat.description} onChange={(e) => setNewCat(v => ({ ...v, description: e.target.value }))} placeholder="Description (optional)" className="h-7 text-sm" />
            <Input value={newCat.skuPrefix} onChange={(e) => setNewCat(v => ({ ...v, skuPrefix: e.target.value.toUpperCase() }))} placeholder="e.g. R" className="h-7 text-sm font-mono" maxLength={10} />
            <div className="flex gap-1">
              <Button size="sm" variant="gold" className="h-7 w-7 p-0" onClick={() => createMutation.mutate(newCat)} disabled={!newCat.name || createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setAdding(false); setNewCat({ name: '', description: '', skuPrefix: '' }); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Catalog: Metal Types ─────────────────────────────────────────────────────

const METAL_PILL: Record<string, string> = {
  gold:        'bg-amber-100 text-amber-800 border-amber-300',
  silver:      'bg-slate-100 text-slate-700 border-slate-300',
  platinum:    'bg-indigo-100 text-indigo-800 border-indigo-300',
  diamond:     'bg-cyan-100 text-cyan-800 border-cyan-300',
  'rose gold': 'bg-rose-100 text-rose-800 border-rose-300',
  'white gold':'bg-blue-50 text-blue-700 border-blue-200',
  other:       'bg-purple-100 text-purple-800 border-purple-300',
};

function MetalTypesSection() {
  const qc = useQueryClient();
  const [newMetal, setNewMetal] = useState({ name: '', prefix: '', label: '' });
  const [adding, setAdding] = useState(false);

  const { data: metalTypes = [] } = useQuery({
    queryKey: ['metal-types'],
    queryFn: () => api.get('/settings/metal-types').then((r) => r.data.data),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof newMetal) => api.post('/settings/metal-types', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metal-types'] });
      setNewMetal({ name: '', prefix: '', label: '' });
      setAdding(false);
      toast({ variant: 'success', title: 'Metal type added' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: err?.response?.data?.error ?? 'Failed to add' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/settings/metal-types/${encodeURIComponent(name)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metal-types'] });
      toast({ variant: 'success', title: 'Metal type removed' });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Metal Types</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-4 w-4" /> Add Metal
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Metal types appear as colored tags on product cards and in the product form. The prefix (e.g. <strong>G</strong>) combines with the category prefix to auto-generate SKUs.
        </p>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_60px_80px_40px] gap-2 px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Metal Name</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prefix</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Label</span>
            <span />
          </div>
          {metalTypes.map((m: any) => (
            <div key={m.name} className="grid grid-cols-[1fr_60px_80px_40px] gap-2 items-center rounded-md border border-border px-2 py-2">
              <div className="flex items-center gap-2">
                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize',
                  METAL_PILL[m.name.toLowerCase()] ?? 'bg-gray-100 text-gray-700 border-gray-300')}>
                  {m.name}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-gold-700">{m.prefix}</span>
              <span className="text-sm">{m.label}</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(m.name)} disabled={deleteMutation.isPending}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {adding && (
          <div className="rounded-lg border border-gold-300 bg-gold-50 p-3 space-y-3">
            <p className="text-sm font-semibold">New Metal Type</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name <span className="text-muted-foreground">(e.g. rose gold)</span></Label>
                <Input value={newMetal.name} onChange={(e) => setNewMetal(v => ({ ...v, name: e.target.value.toLowerCase() }))} placeholder="rose gold" className="h-8" autoFocus />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prefix <span className="text-muted-foreground">(e.g. RG)</span></Label>
                <Input value={newMetal.prefix} onChange={(e) => setNewMetal(v => ({ ...v, prefix: e.target.value.toUpperCase() }))} placeholder="RG" className="h-8 font-mono" maxLength={5} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Display Label</Label>
                <Input value={newMetal.label} onChange={(e) => setNewMetal(v => ({ ...v, label: e.target.value }))} placeholder="Rose Gold" className="h-8" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="gold" onClick={() => addMutation.mutate(newMetal)} disabled={!newMetal.name || !newMetal.prefix || !newMetal.label || addMutation.isPending}>
                {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Metal Type
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewMetal({ name: '', prefix: '', label: '' }); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const activeTab: Tab = SLUG_TO_TAB[tabParam ?? ''] ?? 'Shop';

  function handleTabClick(t: Tab) {
    navigate(`/settings/${TAB_TO_SLUG[t]}`);
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" description="Shop configuration and catalog management" />

      {/* Tab bar */}
      <div className="flex gap-1 px-6 pt-4 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => handleTabClick(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors',
              activeTab === t
                ? 'border-gold-500 text-gold-700 bg-gold-50'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'Shop' && <ShopSettingsForm />}
        {activeTab === 'Metal Rates' && <MetalRatesSection />}
        {activeTab === 'Catalog' && (
          <>
            <CategoriesSection />
            <MetalTypesSection />
          </>
        )}
      </div>
    </div>
  );
}

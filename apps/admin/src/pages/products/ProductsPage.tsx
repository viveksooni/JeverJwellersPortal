import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Image, Trash2, Loader2, Gem, Wand2, Tag, Scale, MapPin, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatWeight, cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// Colored badge styles per metal type — only Gold & Silver supported now
const METAL_TAG: Record<string, { bg: string; label: string }> = {
  'gold':   { bg: 'bg-amber-400 text-amber-950', label: 'Gold' },
  'silver': { bg: 'bg-slate-300 text-slate-900', label: 'Silver' },
};

function getMetalTag(metalName: string): { bg: string; label: string } {
  const key = (metalName ?? '').toLowerCase();
  return METAL_TAG[key] ?? { bg: 'bg-slate-200 text-slate-900', label: metalName || '—' };
}

// Metal + Purity options — kept in sync with server DEFAULT_RATE_KEYS
const METAL_OPTIONS = [
  { value: 'gold',   label: 'Gold' },
  { value: 'silver', label: 'Silver' },
] as const;

const GOLD_PURITIES   = ['24K', '22K', '18K'];
const SILVER_PURITIES = ['925', 'Silver']; // "Silver" = normal/unmarked silver

function getPurities(metalType: string): string[] {
  const m = (metalType ?? '').toLowerCase();
  if (m === 'gold')   return GOLD_PURITIES;
  if (m === 'silver') return SILVER_PURITIES;
  return [];
}

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  categoryId: z.coerce.number({ invalid_type_error: 'Category is required' }).int().positive('Category is required'),
  metalType: z.string().min(1, 'Metal type is required'),
  purity: z.string().min(1, 'Purity is required'),
  sku: z.string().optional(),
  grossWeightG: z.string().optional(),
  netWeightG: z.string().optional(),
  makingCharge: z.string().optional(),
  makingType: z.enum(['flat', 'per_gram', 'percentage']).default('flat'),
  trackingType: z.enum(['template', 'per_piece']).default('template'),
  description: z.string().optional(),
  location: z.string().optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  minStockAlert: z.coerce.number().int().min(0).optional(),
});
type ProductForm = z.infer<typeof productSchema>;

const LOCATION_OPTIONS = ['Showcase A', 'Showcase B', 'Showcase C', 'Safe', 'Display Window', 'Storage'];

// ─── Image Upload Section ─────────────────────────────────────────────────────

function ImageUploadSection({
  label,
  hint,
  existingImages,
  newPreviews,
  onAdd,
  onDeleteExisting,
  onDeleteNew,
  maxImages = 4,
}: {
  label: string;
  hint?: string;
  existingImages: any[];
  newPreviews: { url: string; file: File }[];
  onAdd: (files: File[]) => void;
  onDeleteExisting: (id: string) => void;
  onDeleteNew: (index: number) => void;
  maxImages?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const total = existingImages.length + newPreviews.length;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = maxImages - total;
    onAdd(files.slice(0, remaining));
    e.target.value = '';
  }

  return (
    <div className="space-y-1.5">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {existingImages.map((img: any) => (
          <div key={img.id} className="relative h-20 w-20 rounded-lg overflow-hidden border border-gold-200">
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            {img.isPrimary && (
              <span className="absolute bottom-0 left-0 right-0 bg-gold-500/80 text-white text-[9px] text-center py-0.5">
                Primary
              </span>
            )}
            <button
              type="button"
              className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
              onClick={() => onDeleteExisting(img.id)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {newPreviews.map(({ url }, i) => (
          <div key={`new-${i}`} className="relative h-20 w-20 rounded-lg overflow-hidden border border-dashed border-gold-300">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 text-white text-[9px] text-center py-0.5">
              New
            </span>
            <button
              type="button"
              className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
              onClick={() => onDeleteNew(i)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {total < maxImages && (
          <button
            type="button"
            className="h-20 w-20 rounded-lg border-2 border-dashed border-gold-300 flex flex-col items-center justify-center text-gold-400 hover:bg-gold-50 transition-colors gap-1"
            onClick={() => fileRef.current?.click()}
          >
            <Image className="h-5 w-5" />
            <span className="text-[9px]">Add photo</span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />
    </div>
  );
}

// ─── Product Form Dialog ──────────────────────────────────────────────────────

function ProductFormDialog({ open, onClose, product }: { open: boolean; onClose: () => void; product?: any }) {
  const qc = useQueryClient();

  // Product photos
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [productPreviews, setProductPreviews] = useState<{ url: string; file: File }[]>([]);
  const [existingProductImages, setExistingProductImages] = useState<any[]>([]);

  // Storage photo
  const [storageFiles, setStorageFiles] = useState<File[]>([]);
  const [storagePreviews, setStoragePreviews] = useState<{ url: string; file: File }[]>([]);
  const [existingStorageImages, setExistingStorageImages] = useState<any[]>([]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
  });

  const [skuGenerating, setSkuGenerating] = useState(false);
  const [customLocationMode, setCustomLocationMode] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      makingType: 'flat',
      trackingType: 'template',
      metalType: 'gold',
      purity: '22K',
    },
  });

  // Re-populate form when product changes (edit mode)
  useEffect(() => {
    if (product) {
      reset({
        name: product.name ?? '',
        sku: product.sku ?? '',
        categoryId: product.categoryId ?? undefined,
        metalType: product.metalType ?? 'gold',
        purity: product.purity ?? '',
        grossWeightG: product.grossWeightG ?? '',
        netWeightG: product.netWeightG ?? '',
        makingCharge: product.makingCharge ?? '',
        makingType: product.makingType ?? 'flat',
        trackingType: product.trackingType ?? 'template',
        description: product.description ?? '',
        location: product.inventory?.location ?? '',
        quantity: product.inventory?.quantity ?? 0,
        minStockAlert: product.inventory?.minStockAlert ?? 1,
      });
      setExistingProductImages(product.images ?? []);
      setExistingStorageImages([]);
      const locVal = product.inventory?.location ?? '';
      setCustomLocationMode(!!(locVal && !LOCATION_OPTIONS.includes(locVal)));
    } else {
      setCustomLocationMode(false);
      reset({
        makingType: 'flat',
        trackingType: 'template',
        metalType: 'gold',
        purity: '22K',
        quantity: 0,
        minStockAlert: 1,
      });
      setExistingProductImages([]);
      setExistingStorageImages([]);
    }
    setProductFiles([]);
    setProductPreviews([]);
    setStorageFiles([]);
    setStoragePreviews([]);
  }, [product, reset, open]);

  const metalType = watch('metalType') ?? '';
  const selectedCategoryId = watch('categoryId');
  const trackingType = watch('trackingType');

  const skuPrefix = useCallback(() => {
    const metalPrefixMap: Record<string, string> = { gold: 'G', silver: 'S' };
    const metalP = metalPrefixMap[metalType.toLowerCase()];
    const cat = categories.find((c: any) => c.id === selectedCategoryId);
    if (!metalP || !cat?.skuPrefix) return null;
    return `${metalP}${cat.skuPrefix}`;
  }, [metalType, selectedCategoryId, categories]);

  async function generateSku() {
    const prefix = skuPrefix();
    if (!prefix) {
      toast({ variant: 'destructive', title: 'Select a metal type and category first' });
      return;
    }
    setSkuGenerating(true);
    try {
      const res = await api.get(`/products/meta/next-sku?prefix=${prefix}`);
      setValue('sku', res.data.data.sku);
    } catch {
      toast({ variant: 'destructive', title: 'Could not generate SKU' });
    } finally {
      setSkuGenerating(false);
    }
  }

  const mutation = useMutation({
    mutationFn: async (data: ProductForm) => {
      let res;
      if (product) {
        res = await api.put(`/products/${product.id}`, data);
      } else {
        res = await api.post('/products', data);
      }
      const productId = res.data.data.id;

      // Upload product photos
      const allFiles = [...productFiles, ...storageFiles];
      if (allFiles.length > 0) {
        const fd = new FormData();
        allFiles.forEach((f) => fd.append('images', f));
        await api.post(`/products/${productId}/images`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ variant: 'success', title: product ? 'Product updated' : 'Product added' });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to save product' }),
  });

  async function deleteExistingImage(imageId: string) {
    try {
      await api.delete(`/products/${product.id}/images/${imageId}`);
      setExistingProductImages((prev) => prev.filter((img) => img.id !== imageId));
      setExistingStorageImages((prev) => prev.filter((img) => img.id !== imageId));
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to delete image' });
    }
  }

  function addProductFiles(files: File[]) {
    const newEntries = files.map((f) => ({ url: URL.createObjectURL(f), file: f }));
    setProductPreviews((p) => [...p, ...newEntries]);
    setProductFiles((f) => [...f, ...files]);
  }

  function removeProductPreview(i: number) {
    setProductPreviews((p) => p.filter((_, j) => j !== i));
    setProductFiles((f) => f.filter((_, j) => j !== i));
  }

  function addStorageFiles(files: File[]) {
    const newEntries = files.map((f) => ({ url: URL.createObjectURL(f), file: f }));
    setStoragePreviews((p) => [...p, ...newEntries]);
    setStorageFiles((f) => [...f, ...files]);
  }

  function removeStoragePreview(i: number) {
    setStoragePreviews((p) => p.filter((_, j) => j !== i));
    setStorageFiles((f) => f.filter((_, j) => j !== i));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d), (errs) => {
          const first = Object.values(errs)[0] as any;
          toast({ variant: 'destructive', title: first?.message || 'Please fill all required fields' });
        })} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Product Name */}
            <div className="space-y-1.5 col-span-2">
              <Label>Product Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="e.g. Chain, Ring, Bangle" />
              <p className="text-[11px] text-muted-foreground">Don't include metal or purity in the name — those are fields below.</p>
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select
                value={watch('categoryId') ? String(watch('categoryId')) : ''}
                onValueChange={(v) => {
                  setValue('categoryId', Number(v), { shouldValidate: true });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}{c.skuPrefix ? ` (${c.skuPrefix})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
            </div>

            {/* Item Type */}
            <div className="space-y-1.5">
              <Label>Item Type <span className="text-destructive">*</span></Label>
              <Select value={watch('trackingType')} onValueChange={(v) => setValue('trackingType', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Bulk / Quantity</SelectItem>
                  <SelectItem value="per_piece">Per Piece</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Bulk = sold by count/weight; Per Piece = each item tracked individually
              </p>
            </div>

            {/* Metal Type */}
            <div className="space-y-1.5">
              <Label>Metal <span className="text-destructive">*</span></Label>
              <Select
                value={metalType}
                onValueChange={(v) => {
                  setValue('metalType', v, { shouldValidate: true });
                  // reset purity to the first valid option for the new metal
                  const defaultPurity = v === 'gold' ? '22K' : v === 'silver' ? '925' : '';
                  setValue('purity', defaultPurity, { shouldValidate: true });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select metal" /></SelectTrigger>
                <SelectContent>
                  {METAL_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.metalType && <p className="text-xs text-destructive">{errors.metalType.message}</p>}
            </div>

            {/* Purity */}
            <div className="space-y-1.5">
              <Label>Purity <span className="text-destructive">*</span></Label>
              <Select value={watch('purity') ?? ''} onValueChange={(v) => setValue('purity', v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select purity" /></SelectTrigger>
                <SelectContent>
                  {getPurities(metalType).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.purity && <p className="text-xs text-destructive">{errors.purity.message}</p>}
            </div>

            {/* SKU */}
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <div className="flex gap-2 items-center">
                <Input {...register('sku')} placeholder="Auto-generated" className="flex-1 font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateSku}
                  disabled={skuGenerating}
                  title={skuPrefix() ? `Auto-generate next ${skuPrefix()}-NNN` : 'Select metal + category first'}
                  className="shrink-0 gap-1.5"
                >
                  {skuGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {skuPrefix() ? `Gen ${skuPrefix()}` : 'Auto'}
                </Button>
              </div>
            </div>

            {/* Weights */}
            <div className="space-y-1.5">
              <Label>Gross Weight (g)</Label>
              <Input {...register('grossWeightG')} placeholder="12.500" inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label>Net Weight (g)</Label>
              <Input {...register('netWeightG')} placeholder="11.200" inputMode="decimal" />
            </div>

            {/* Making charge */}
            <div className="space-y-1.5">
              <Label>Making Charge</Label>
              <Input {...register('makingCharge')} placeholder="500" inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label>Making Charge Type</Label>
              <Select value={watch('makingType')} onValueChange={(v) => setValue('makingType', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat (₹)</SelectItem>
                  <SelectItem value="per_gram">Per Gram (₹/g)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stock section — INVENTORY FIELDS */}
            <div className="col-span-2 pt-2 mt-2 border-t border-border">
              <p className="text-sm font-semibold text-foreground mb-2">Stock &amp; Location</p>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              {!customLocationMode ? (
                <Select
                  value={watch('location') ?? ''}
                  onValueChange={(v) => {
                    if (v === '__custom__') {
                      setCustomLocationMode(true);
                      setValue('location', '');
                    } else {
                      setValue('location', v);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Where is it kept?" /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_OPTIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom location…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    {...register('location')}
                    placeholder="e.g. Vault 2, Counter B, Locker 3"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => { setCustomLocationMode(false); setValue('location', ''); }}
                  >
                    Preset
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Opening Quantity</Label>
              <Input {...register('quantity')} type="number" min={0} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stock Alert</Label>
              <Input {...register('minStockAlert')} type="number" min={0} placeholder="1" />
            </div>

            {/* Description */}
            <div className="space-y-1.5 col-span-2">
              <Label>Description</Label>
              <Input {...register('description')} placeholder="Brief description…" />
            </div>
          </div>

          {/* Image Upload Sections */}
          <div className="space-y-4 pt-2 border-t border-border">
            <p className="text-sm font-semibold text-foreground">Photos</p>
            <ImageUploadSection
              label="Product Photos"
              hint="Main product images (up to 6)"
              existingImages={existingProductImages}
              newPreviews={productPreviews}
              onAdd={addProductFiles}
              onDeleteExisting={deleteExistingImage}
              onDeleteNew={removeProductPreview}
              maxImages={6}
            />
            <ImageUploadSection
              label="Storage / Stock Photo"
              hint="Photo of the full stock batch in storage"
              existingImages={existingStorageImages}
              newPreviews={storagePreviews}
              onAdd={addStorageFiles}
              onDeleteExisting={deleteExistingImage}
              onDeleteNew={removeStoragePreview}
              maxImages={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {product ? 'Update Product' : 'Add Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [trackingType, setTrackingType] = useState('all');

  const [pendingEditId, setPendingEditId] = useState<string | null>(() => (location.state as any)?.editId ?? null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, categoryId],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' });
      if (search) params.set('search', search);
      if (categoryId && categoryId !== 'all') params.set('categoryId', categoryId);
      return api.get(`/products?${params}`).then((r) => r.data);
    },
    staleTime: 30_000,
  });

  const allProducts: any[] = data?.data ?? [];

  // Open edit dialog once when navigated here with editId state (from ProductDetailPage)
  useEffect(() => {
    if (!pendingEditId || allProducts.length === 0) return;
    const p = allProducts.find((x: any) => x.id === pendingEditId);
    if (p) {
      setPendingEditId(null); // clear immediately so search changes don't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
      setEditProduct(p);
      setShowForm(true);
    }
  }, [pendingEditId, allProducts.length]);

  // Category summary stats
  const categoryStats = useMemo(() => {
    if (categoryId === 'all' || allProducts.length === 0) return null;
    const selectedCat = categories.find((c: any) => String(c.id) === categoryId);
    const inStockProducts = allProducts.filter((p: any) => (p.inventory?.quantity ?? 0) > 0);
    const totalUnits = allProducts.reduce((s: number, p: any) => s + (p.inventory?.quantity ?? 0), 0);
    const totalWeight = allProducts.reduce((s: number, p: any) => {
      const w = p.inventory?.totalWeightG ?? 0;
      return s + parseFloat(w || '0');
    }, 0);
    const locations = [...new Set(allProducts.map((p: any) => p.inventory?.location).filter(Boolean))];
    return { name: selectedCat?.name, inStockProducts: inStockProducts.length, total: allProducts.length, totalUnits, totalWeight, locations };
  }, [allProducts, categoryId, categories]);

  const products = trackingType === 'all'
    ? allProducts
    : allProducts.filter((p: any) => p.trackingType === trackingType);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Inventory"
        description={`${data?.total ?? 0} items`}
        action={
          <Button variant="gold" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters row */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={trackingType} onValueChange={setTrackingType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="template">Bulk / Template</SelectItem>
              <SelectItem value="per_piece">Per Piece</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or SKU…" className="pl-9 w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Category stats */}
        {categoryStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-secondary/50 border">
            <div className="text-center">
              <p className="text-2xl font-heading font-bold text-gold-600">{categoryStats.total}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Product Types</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-heading font-bold text-emerald-600">{categoryStats.inStockProducts}</p>
              <p className="text-xs text-muted-foreground mt-0.5">In Stock</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-heading font-bold">{categoryStats.totalUnits}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Units</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-heading font-bold flex items-center justify-center gap-1">
                <Scale className="h-5 w-5 text-muted-foreground" />
                {categoryStats.totalWeight > 0 ? `${categoryStats.totalWeight.toFixed(1)}g` : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Weight</p>
            </div>
            {categoryStats.locations.length > 0 && (
              <div className="col-span-2 sm:col-span-4 flex items-center gap-1.5 pt-2 border-t border-border text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>Locations: </span>
                {categoryStats.locations.map((loc: string) => (
                  <span key={loc} className="px-2 py-0.5 rounded-full bg-background border text-foreground font-medium">{loc}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p: any) => {
            const primaryImg = p.images?.find((i: any) => i.isPrimary) ?? p.images?.[0];
            const isPerPiece = p.trackingType === 'per_piece';
            const stock = p.inventory?.quantity ?? 0;
            const stockColor = stock === 0 ? 'text-red-500' : stock <= (p.inventory?.minStockAlert ?? 1) ? 'text-amber-500' : 'text-emerald-600';
            return (
              <Card
                key={p.id}
                className="overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
                onClick={() => navigate(`/products/${p.id}`)}
              >
                <div className="aspect-square bg-secondary overflow-hidden relative">
                  {primaryImg ? (
                    <img src={primaryImg.url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gold-300">
                      <Gem className="h-10 w-10" />
                    </div>
                  )}
                  {p.metalType && (() => {
                    const tag = getMetalTag(p.metalType);
                    return (
                      <span className={cn(
                        'absolute top-1.5 left-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shadow-sm',
                        tag.bg
                      )}>
                        {tag.label}
                      </span>
                    );
                  })()}
                  {/* Per-piece vs Bulk badge */}
                  <span className={cn(
                    'absolute bottom-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                    isPerPiece
                      ? 'bg-amber-700/80 text-amber-50'
                      : 'bg-slate-700/70 text-slate-100'
                  )}>
                    {isPerPiece ? 'Per Piece' : 'Bulk'}
                  </span>
                </div>
                <CardContent className="p-3 space-y-1.5">
                  <div>
                    <p className="text-sm font-medium leading-tight line-clamp-2">{p.name}</p>
                    {p.sku && <p className="text-[10px] font-mono text-gold-600 mt-0.5">{p.sku}</p>}
                    {p.category && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{p.category.name}</p>
                    )}
                  </div>

                  {isPerPiece ? (
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3 w-3 text-amber-700 shrink-0" />
                      <span className={cn('text-xs font-semibold', stockColor)}>
                        {stock === 0 ? 'Out of stock' : `${stock} pcs`}
                      </span>
                      {p.grossWeightG && (
                        <span className="text-[10px] text-muted-foreground">· {formatWeight(p.grossWeightG)} ea</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3 w-3 text-slate-500 shrink-0" />
                      <span className={cn('text-xs font-semibold', stockColor)}>
                        {stock === 0 ? 'Out of stock' : `Qty: ${stock}`}
                      </span>
                      {p.inventory?.totalWeightG && (
                        <span className="text-[10px] text-muted-foreground">· {formatWeight(p.inventory.totalWeightG)}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {!isLoading && products.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Gem className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-heading">No products found</p>
              <p className="text-sm mt-1">Add your first jewelry product to get started.</p>
            </div>
          )}
        </div>
      </div>

      <ProductFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditProduct(null); }}
        product={editProduct}
      />
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Image, Trash2, Loader2, Gem, Wand2, Tag, Archive } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { GOLD_PURITIES, SILVER_PURITIES, PLATINUM_PURITIES } from '@jever/shared';
import { formatWeight, cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// Colored badge styles per metal type
const METAL_TAG: Record<string, { bg: string; label: string }> = {
  'gold':       { bg: 'bg-amber-400 text-amber-950',   label: 'Gold' },
  'silver':     { bg: 'bg-slate-300 text-slate-900',   label: 'Silver' },
  'platinum':   { bg: 'bg-indigo-300 text-indigo-950', label: 'Platinum' },
  'diamond':    { bg: 'bg-cyan-300 text-cyan-950',     label: 'Diamond' },
  'rose gold':  { bg: 'bg-rose-300 text-rose-950',     label: 'Rose Gold' },
  'white gold': { bg: 'bg-blue-200 text-blue-900',     label: 'White Gold' },
  'other':      { bg: 'bg-purple-200 text-purple-900', label: 'Other' },
};

function getMetalTag(metalName: string): { bg: string; label: string } {
  const key = metalName.toLowerCase();
  return METAL_TAG[key] ?? { bg: 'bg-purple-200 text-purple-900', label: metalName };
}

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  categoryId: z.coerce.number().optional(),
  metalType: z.string().optional(),
  purity: z.string().optional(),
  grossWeightG: z.string().optional(),
  netWeightG: z.string().optional(),
  stoneType: z.string().optional(),
  stoneWeightCt: z.string().optional(),
  makingCharge: z.string().optional(),
  makingType: z.enum(['flat', 'per_gram', 'percentage']).default('flat'),
  trackingType: z.enum(['template', 'per_piece']).default('template'),
  description: z.string().optional(),
});
type ProductForm = z.infer<typeof productSchema>;

function getPurities(metalType: string) {
  const m = metalType.toLowerCase();
  if (m === 'gold' || m === 'rose gold' || m === 'white gold') return GOLD_PURITIES;
  if (m === 'silver') return SILVER_PURITIES;
  if (m === 'platinum') return PLATINUM_PURITIES;
  return [];
}

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

  const { data: metalTypes = [] } = useQuery({
    queryKey: ['metal-types'],
    queryFn: () => api.get('/settings/metal-types').then((r) => r.data.data),
  });

  const [skuGenerating, setSkuGenerating] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { makingType: 'flat', trackingType: 'template' },
  });

  // Re-populate form when product changes (edit mode)
  useEffect(() => {
    if (product) {
      reset({
        name: product.name ?? '',
        sku: product.sku ?? '',
        categoryId: product.categoryId ?? undefined,
        metalType: product.metalType ?? '',
        purity: product.purity ?? '',
        grossWeightG: product.grossWeightG ?? '',
        netWeightG: product.netWeightG ?? '',
        stoneType: product.stoneType ?? '',
        stoneWeightCt: product.stoneWeightCt ?? '',
        makingCharge: product.makingCharge ?? '',
        makingType: product.makingType ?? 'flat',
        trackingType: product.trackingType ?? 'template',
        description: product.description ?? '',
      });
      // Split images: first image is product photo, last one tagged 'storage' or separate by isPrimary
      const imgs = product.images ?? [];
      // Storage images are stored as last image with no isPrimary flag (convention)
      // For now, treat all existing as product images; storage section starts empty on edit
      setExistingProductImages(imgs);
      setExistingStorageImages([]);
    } else {
      reset({ makingType: 'flat', trackingType: 'template' });
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
    const metal = metalTypes.find((m: any) => m.name === metalType);
    const cat = categories.find((c: any) => c.id === selectedCategoryId);
    if (!metal?.prefix || !cat?.skuPrefix) return null;
    return `${metal.prefix}${cat.skuPrefix}`;
  }, [metalType, selectedCategoryId, metalTypes, categories]);

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

  const isPerPiece = trackingType === 'per_piece';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Product Name *</Label>
              <Input {...register('name')} placeholder="e.g. 22K Gold Necklace" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={watch('categoryId') ? String(watch('categoryId')) : ''}
                onValueChange={(v) => {
                  setValue('categoryId', Number(v));
                  const cat = categories.find((c: any) => c.id === Number(v));
                  if (cat?.trackingType) setValue('trackingType', cat.trackingType as any);
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
            </div>
            <div className="space-y-1.5">
              <Label>Metal Type</Label>
              <Select
                value={metalType}
                onValueChange={(v) => { setValue('metalType', v); setValue('purity', ''); }}
              >
                <SelectTrigger><SelectValue placeholder="Select metal" /></SelectTrigger>
                <SelectContent>
                  {metalTypes.map((m: any) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.label} <span className="text-muted-foreground text-[10px] ml-1">({m.prefix})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>SKU</Label>
              <div className="flex gap-2 items-center">
                <Input {...register('sku')} placeholder="e.g. GR-001" className="flex-1 font-mono" />
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
                  {skuPrefix() ? `Generate ${skuPrefix()}` : 'Auto SKU'}
                </Button>
              </div>
              {skuPrefix() && (
                <p className="text-[11px] text-muted-foreground">
                  Prefix <span className="font-mono font-semibold text-gold-700">{skuPrefix()}</span> = {
                    metalTypes.find((m: any) => m.name === metalType)?.label
                  } + {categories.find((c: any) => c.id === selectedCategoryId)?.name}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Purity</Label>
              {getPurities(metalType).length > 0 ? (
                <Select value={watch('purity') ?? ''} onValueChange={(v) => setValue('purity', v)}>
                  <SelectTrigger><SelectValue placeholder="Select purity" /></SelectTrigger>
                  <SelectContent>
                    {getPurities(metalType).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input {...register('purity')} placeholder="e.g. 22K, 925" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Gross Weight (g)</Label>
              <Input {...register('grossWeightG')} placeholder="12.500" />
            </div>
            <div className="space-y-1.5">
              <Label>Net Weight (g)</Label>
              <Input {...register('netWeightG')} placeholder="11.200" />
            </div>
            <div className="space-y-1.5">
              <Label>Stone Type</Label>
              <Input {...register('stoneType')} placeholder="diamond, ruby…" />
            </div>
            <div className="space-y-1.5">
              <Label>Stone Weight (ct)</Label>
              <Input {...register('stoneWeightCt')} placeholder="0.25" />
            </div>
            <div className="space-y-1.5">
              <Label>Making Charge</Label>
              <Input {...register('makingCharge')} placeholder="500" />
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
            <div className="space-y-1.5 col-span-2">
              <Label>Stock Tracking</Label>
              <Select value={watch('trackingType')} onValueChange={(v) => setValue('trackingType', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Template — track total quantity only</SelectItem>
                  <SelectItem value="per_piece">Per Piece — track each physical piece individually</SelectItem>
                </SelectContent>
              </Select>
              {(() => {
                const cat = categories.find((c: any) => c.id === selectedCategoryId);
                return cat?.trackingType ? (
                  <p className="text-[11px] text-muted-foreground">
                    Category default: <span className="font-semibold">{cat.trackingType === 'per_piece' ? 'Per Piece' : 'Template'}</span>
                  </p>
                ) : null;
              })()}
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Description</Label>
              <Input {...register('description')} placeholder="Brief description…" />
            </div>
          </div>

          {/* Image Upload Sections */}
          <div className="space-y-4 pt-2 border-t border-border">
            <p className="text-sm font-semibold text-foreground">Photos</p>

            {isPerPiece ? (
              <>
                <ImageUploadSection
                  label="Per-Piece Photo"
                  hint="Photo of an individual piece for reference"
                  existingImages={existingProductImages}
                  newPreviews={productPreviews}
                  onAdd={addProductFiles}
                  onDeleteExisting={deleteExistingImage}
                  onDeleteNew={removeProductPreview}
                  maxImages={4}
                />
                <ImageUploadSection
                  label="Storage / Showcase Photo"
                  hint="Photo showing the full lot or storage tray"
                  existingImages={existingStorageImages}
                  newPreviews={storagePreviews}
                  onAdd={addStorageFiles}
                  onDeleteExisting={deleteExistingImage}
                  onDeleteNew={removeStoragePreview}
                  maxImages={2}
                />
              </>
            ) : (
              <>
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
              </>
            )}
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

type TrackingTab = 'all' | 'per_piece' | 'template';

export function ProductsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [metalType, setMetalType] = useState('all');
  const [purity, setPurity] = useState('all');
  const [trackingTab, setTrackingTab] = useState<TrackingTab>('all');
  const qc = useQueryClient();

  const [pendingEditId, setPendingEditId] = useState<string | null>(
    () => (location.state as any)?.editId ?? null
  );

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
  });

  const { data: metalTypes = [] } = useQuery({
    queryKey: ['metal-types'],
    queryFn: () => api.get('/settings/metal-types').then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, categoryId, metalType],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' });
      if (search) params.set('search', search);
      if (categoryId && categoryId !== 'all') params.set('categoryId', categoryId);
      if (metalType && metalType !== 'all') params.set('metalType', metalType);
      return api.get(`/products?${params}`).then((r) => r.data);
    },
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ variant: 'success', title: 'Product archived' });
      setDeleteTarget(null);
    },
    onError: () => toast({ variant: 'destructive', title: 'Delete failed' }),
  });

  const allProducts: any[] = data?.data ?? [];

  // Open edit form when navigated here from ProductDetailPage with editId state
  useEffect(() => {
    if (pendingEditId && allProducts.length > 0) {
      const p = allProducts.find((x) => x.id === pendingEditId);
      if (p) {
        setEditProduct(p);
        setShowForm(true);
        setPendingEditId(null);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [pendingEditId, allProducts.length]);

  // Client-side filters
  const products = allProducts.filter((p) => {
    const matchTracking = trackingTab === 'all' || p.trackingType === trackingTab;
    const matchPurity = purity === 'all' || p.purity === purity;
    return matchTracking && matchPurity;
  });

  // Collect unique purities from loaded products for filter dropdown
  const purities = Array.from(new Set(allProducts.map((p: any) => p.purity).filter(Boolean))) as string[];

  // Counts for tabs
  const perPieceCount = allProducts.filter((p) => p.trackingType === 'per_piece').length;
  const templateCount = allProducts.filter((p) => p.trackingType === 'template').length;

  const TRACKING_TABS: { key: TrackingTab; label: string; count: number }[] = [
    { key: 'all', label: 'All Products', count: allProducts.length },
    { key: 'per_piece', label: 'Per Piece', count: perPieceCount },
    { key: 'template', label: 'Template / Bulk', count: templateCount },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Products"
        description={`${data?.total ?? 0} products`}
        action={
          <Button variant="gold" size="sm" onClick={() => { setEditProduct(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Tracking type tabs */}
        <div className="flex gap-1 border-b border-border pb-0">
          {TRACKING_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTrackingTab(t.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
                trackingTab === t.key
                  ? 'border-gold-500 text-gold-700'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.key === 'per_piece' && <Tag className="h-3.5 w-3.5" />}
              {t.key === 'template' && <Archive className="h-3.5 w-3.5" />}
              {t.label}
              <span className={cn(
                'text-[10px] rounded-full px-1.5 py-0.5 font-semibold',
                trackingTab === t.key ? 'bg-gold-100 text-gold-700' : 'bg-secondary text-muted-foreground'
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Category pill tabs */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setCategoryId('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
              categoryId === 'all'
                ? 'bg-gold-500 text-white border-gold-500'
                : 'border-border bg-background hover:bg-accent'
            )}
          >
            All
          </button>
          {categories.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(String(c.id))}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
                categoryId === String(c.id)
                  ? 'bg-gold-500 text-white border-gold-500'
                  : 'border-border bg-background hover:bg-accent'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Search + metal + purity filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products…" className="pl-9 w-52" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={metalType} onValueChange={setMetalType}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Metal type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Metals</SelectItem>
              {metalTypes.map((m: any) => (
                <SelectItem key={m.name} value={m.name}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={purity} onValueChange={setPurity}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Purity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Purities</SelectItem>
              {purities.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Per-Piece section header */}
        {trackingTab === 'per_piece' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2 text-amber-800 text-sm">
            <Tag className="h-4 w-4" />
            <span>Per-piece products — each physical item is tracked individually. Manage pieces via Inventory page.</span>
          </div>
        )}

        {/* Template section header */}
        {trackingTab === 'template' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center gap-2 text-slate-700 text-sm">
            <Archive className="h-4 w-4" />
            <span>Template / bulk products — total quantity and weight tracked. Adjust stock via Inventory page.</span>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p: any) => {
            const primaryImg = p.images?.find((i: any) => i.isPrimary) ?? p.images?.[0];
            const isPerPiece = p.trackingType === 'per_piece';
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
                  {p.images?.length > 1 && (
                    <Badge variant="secondary" className="absolute top-1 right-1 text-[10px] py-0">
                      +{p.images.length - 1}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-3 space-y-2">
                  <div>
                    <p className="text-sm font-medium leading-tight line-clamp-2">{p.name}</p>
                    {p.sku && <p className="text-[10px] font-mono text-gold-600 mt-0.5">{p.sku}</p>}
                    <div className="flex gap-1 flex-wrap mt-1">
                      {p.category && <Badge variant="outline" className="text-[10px] py-0">{p.category.name}</Badge>}
                      {p.purity && <Badge variant="secondary" className="text-[10px] py-0 font-mono">{p.purity}</Badge>}
                    </div>
                  </div>

                  {isPerPiece ? (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {p.grossWeightG && <span className="block">{formatWeight(p.grossWeightG)} (typical)</span>}
                      <div className="flex items-center gap-1 text-amber-700">
                        <Tag className="h-3 w-3" />
                        <span className="text-[10px] font-semibold">{p.inventory?.quantity ?? 0} pcs in stock</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {p.grossWeightG && <span className="block">Unit: {formatWeight(p.grossWeightG)}</span>}
                      <div className="flex gap-2">
                        <Badge
                          variant={p.inventory?.quantity > p.inventory?.minStockAlert ? 'success' : 'warning'}
                          className="text-[10px] py-0"
                        >
                          Qty: {p.inventory?.quantity ?? 0}
                        </Badge>
                        {p.inventory?.totalWeightG && (
                          <span className="text-[10px] text-muted-foreground self-center">
                            {formatWeight(p.inventory.totalWeightG)} total
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                      onClick={() => { setEditProduct(p); setShowForm(true); }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!isLoading && products.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Gem className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-heading">No products found</p>
              <p className="text-sm mt-1">
                {trackingTab !== 'all'
                  ? `No ${trackingTab === 'per_piece' ? 'per-piece' : 'template'} products yet`
                  : 'Add your first jewelry product'}
              </p>
            </div>
          )}
        </div>
      </div>

      <ProductFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditProduct(null); }}
        product={editProduct}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this product?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be archived and removed from the catalog.
              Existing transaction records will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

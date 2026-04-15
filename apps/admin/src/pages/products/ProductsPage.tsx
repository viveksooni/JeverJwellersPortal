import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Image, Trash2, Loader2, Gem } from 'lucide-react';
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
import { METAL_TYPES, GOLD_PURITIES, SILVER_PURITIES, PLATINUM_PURITIES } from '@jever/shared';
import { formatWeight } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

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
  description: z.string().optional(),
});
type ProductForm = z.infer<typeof productSchema>;

function getPurities(metalType: string) {
  if (metalType === 'gold') return GOLD_PURITIES;
  if (metalType === 'silver') return SILVER_PURITIES;
  if (metalType === 'platinum') return PLATINUM_PURITIES;
  return [];
}

function ProductFormDialog({ open, onClose, product }: { open: boolean; onClose: () => void; product?: any }) {
  const qc = useQueryClient();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/products/meta/categories').then((r) => r.data.data),
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { makingType: 'flat' },
  });

  // ✅ Re-populate form when product changes (edit mode)
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
        description: product.description ?? '',
      });
      // Load existing images
      setExistingImages(product.images ?? []);
      setImageFiles([]);
      setPreviews([]);
    } else {
      reset({ makingType: 'flat' });
      setExistingImages([]);
      setImageFiles([]);
      setPreviews([]);
    }
  }, [product, reset, open]);

  const metalType = watch('metalType') ?? '';

  const mutation = useMutation({
    mutationFn: async (data: ProductForm) => {
      let res;
      if (product) {
        res = await api.put(`/products/${product.id}`, data);
      } else {
        res = await api.post('/products', data);
      }
      const productId = res.data.data.id;

      // Upload new images if any
      if (imageFiles.length > 0) {
        const fd = new FormData();
        imageFiles.forEach((f) => fd.append('images', f));
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newFiles = [...imageFiles, ...files].slice(0, 8 - existingImages.length);
    setImageFiles(newFiles);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setPreviews(newPreviews);
  }

  async function deleteExistingImage(imageId: string) {
    try {
      await api.delete(`/products/${product.id}/images/${imageId}`);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to delete image' });
    }
  }

  const totalImages = existingImages.length + previews.length;

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
              <Label>SKU</Label>
              <Input {...register('sku')} placeholder="GLD-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={watch('categoryId') ? String(watch('categoryId')) : ''}
                onValueChange={(v) => setValue('categoryId', Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
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
                  {METAL_TYPES.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>Description</Label>
              <Input {...register('description')} placeholder="Brief description…" />
            </div>
          </div>

          {/* Image upload — shows existing + new */}
          <div className="space-y-2">
            <Label>Product Images (max 8) {product && <span className="text-xs text-muted-foreground ml-1">— existing images shown below</span>}</Label>
            <div className="flex flex-wrap gap-2">
              {/* Existing images */}
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
                    onClick={() => deleteExistingImage(img.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {/* New image previews */}
              {previews.map((url, i) => (
                <div key={`new-${i}`} className="relative h-20 w-20 rounded-lg overflow-hidden border border-dashed border-gold-300">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 text-white text-[9px] text-center py-0.5">
                    New
                  </span>
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
                    onClick={() => {
                      setPreviews((p) => p.filter((_, j) => j !== i));
                      setImageFiles((f) => f.filter((_, j) => j !== i));
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {totalImages < 8 && (
                <button
                  type="button"
                  className="h-20 w-20 rounded-lg border-2 border-dashed border-gold-300 flex items-center justify-center text-gold-400 hover:bg-gold-50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Image className="h-6 w-6" />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
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

export function ProductsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [metalType, setMetalType] = useState('all');
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/products/meta/categories').then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, categoryId, metalType],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
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

  const products = data?.data ?? [];

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
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products…" className="pl-9 w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={metalType} onValueChange={setMetalType}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Metal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Metals</SelectItem>
              {METAL_TYPES.map((m) => (
                <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p: any) => {
            const primaryImg = p.images?.find((i: any) => i.isPrimary) ?? p.images?.[0];
            return (
              <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                <div className="aspect-square bg-secondary overflow-hidden relative">
                  {primaryImg ? (
                    <img src={primaryImg.url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gold-300">
                      <Gem className="h-10 w-10" />
                    </div>
                  )}
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
                      {p.purity && <Badge variant="secondary" className="text-[10px] py-0">{p.purity}</Badge>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.grossWeightG && <span>{formatWeight(p.grossWeightG)}</span>}
                  </div>
                  <div className="flex gap-1">
                    <Badge
                      variant={p.inventory?.quantity > p.inventory?.minStockAlert ? 'success' : 'warning'}
                      className="text-[10px] py-0"
                    >
                      Stock: {p.inventory?.quantity ?? 0}
                    </Badge>
                  </div>
                  <div className="flex gap-1.5 pt-1">
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
              <p className="text-lg font-heading">No products yet</p>
              <p className="text-sm mt-1">Add your first jewelry product</p>
            </div>
          )}
        </div>
      </div>

      <ProductFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditProduct(null); }}
        product={editProduct}
      />

      {/* ✅ Delete confirmation with shadcn AlertDialog */}
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

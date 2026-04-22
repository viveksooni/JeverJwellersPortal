import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft, Pencil, Trash2, Plus, Scale, Gem,
  ChevronLeft, ChevronRight, Loader2, Package,
  AlertCircle, MapPin, Tag, Layers, TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatWeight, formatCurrency, cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const METAL_BG: Record<string, string> = {
  gold:   'bg-amber-100 text-amber-800 border-amber-300',
  silver: 'bg-slate-100 text-slate-700 border-slate-300',
};
function metalBg(m: string) {
  return METAL_BG[m?.toLowerCase()] ?? 'bg-secondary text-muted-foreground border-border';
}

const addStockSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'At least 1'),
  weightG: z.string().optional(),
  notes: z.string().optional(),
});
type AddStockForm = z.infer<typeof addStockSchema>;

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [imgIdx, setImgIdx] = useState(0);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['movements', id],
    queryFn: () =>
      api.get('/inventory/movements/log?limit=50').then((r) =>
        r.data.data.filter((m: any) => m.productId === id),
      ),
    enabled: !!id,
  });

  const { data: relatedProducts = [] } = useQuery({
    queryKey: ['related-products', product?.categoryId],
    queryFn: () =>
      api.get(`/products?categoryId=${product.categoryId}&limit=9`).then((r) =>
        (r.data.data as any[]).filter((p: any) => p.id !== id),
      ),
    enabled: !!product?.categoryId,
  });

  useEffect(() => { setImgIdx(0); }, [id]);

  const stockForm = useForm<AddStockForm>({
    resolver: zodResolver(addStockSchema),
    defaultValues: { quantity: 1 },
  });

  const addStockMutation = useMutation({
    mutationFn: (data: AddStockForm) =>
      api.patch(`/inventory/${id}`, {
        quantity: data.quantity,
        weightG: data.weightG || undefined,
        notes: data.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', id] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ variant: 'success', title: 'Stock updated' });
      stockForm.reset({ quantity: 1 });
      setShowAddStock(false);
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to update stock' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ variant: 'success', title: 'Product archived' });
      navigate('/products');
    },
    onError: () => toast({ variant: 'destructive', title: 'Delete failed' }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Product Details" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Product not found" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <AlertCircle className="h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">Product not found or was archived.</p>
          <Button variant="outline" onClick={() => navigate('/products')}>Back to Inventory</Button>
        </div>
      </div>
    );
  }

  const images: any[] = product.images ?? [];
  const stock = product.inventory?.quantity ?? 0;
  const isLow = stock > 0 && stock <= (product.inventory?.minStockAlert ?? 1);
  const isOut = stock === 0;
  const isPerPiece = product.trackingType === 'per_piece';
  const currentImg = images[imgIdx];

  const stockStatus = isOut ? 'out' : isLow ? 'low' : 'ok';
  const stockColors = {
    out: { bg: 'bg-red-50 border-red-200', num: 'text-red-700', sub: 'text-red-500', label: 'Out of Stock' },
    low: { bg: 'bg-amber-50 border-amber-200', num: 'text-amber-700', sub: 'text-amber-500', label: 'Low Stock' },
    ok:  { bg: 'bg-emerald-50 border-emerald-200', num: 'text-emerald-700', sub: 'text-emerald-500', label: 'In Stock' },
  }[stockStatus];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={product.name}
        description={product.sku ? `SKU: ${product.sku}` : product.category?.name}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/products')}>
              <ArrowLeft className="h-4 w-4" /> Inventory
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/products', { state: { editId: product.id } })}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Hero card ── */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">

            {/* Image column */}
            <div className="lg:col-span-2 bg-secondary">
              <div className="aspect-square relative">
                {currentImg ? (
                  <img src={currentImg.url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gold-200">
                    <Gem className="h-20 w-20" />
                  </div>
                )}
                {images.length > 1 && (
                  <>
                    <button
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                      onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                      onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      {imgIdx + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-1.5 p-2 bg-secondary/60 border-t border-border flex-wrap">
                  {images.map((img: any, i: number) => (
                    <button
                      key={img.id}
                      onClick={() => setImgIdx(i)}
                      className={cn(
                        'h-12 w-12 rounded overflow-hidden border-2 transition-all',
                        i === imgIdx ? 'border-gold-500' : 'border-transparent opacity-50 hover:opacity-80',
                      )}
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info column */}
            <div className="lg:col-span-3 p-6 flex flex-col gap-5">

              {/* Name + badges */}
              <div>
                <h2 className="text-2xl font-heading font-bold text-foreground leading-tight">{product.name}</h2>
                {product.sku && (
                  <p className="font-mono text-sm text-gold-600 mt-1">{product.sku}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {product.metalType && (
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border capitalize', metalBg(product.metalType))}>
                      {product.metalType}
                    </span>
                  )}
                  {product.purity && (
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground">
                      {product.purity}
                    </span>
                  )}
                  {product.category && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground">
                      {product.category.name}
                    </span>
                  )}
                  <span className={cn(
                    'text-xs font-semibold px-2.5 py-1 rounded-full',
                    isPerPiece ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700 border border-slate-300'
                  )}>
                    {isPerPiece ? 'Per Piece' : 'Bulk'}
                  </span>
                </div>
              </div>

              {/* Key stats row */}
              <div className="grid grid-cols-3 gap-3">
                {/* Stock */}
                <div className={cn('rounded-xl border p-4 text-center', stockColors.bg)}>
                  <p className={cn('text-3xl font-heading font-bold', stockColors.num)}>{stock}</p>
                  <p className={cn('text-xs mt-0.5 font-medium', stockColors.sub)}>{stockColors.label}</p>
                </div>

                {/* Total weight */}
                <div className="rounded-xl border bg-secondary/30 p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xl font-heading font-bold">
                      {product.inventory?.totalWeightG ? formatWeight(product.inventory.totalWeightG) : '—'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Weight</p>
                </div>

                {/* Unit weight */}
                <div className="rounded-xl border bg-secondary/30 p-4 text-center">
                  <p className="text-xl font-heading font-bold">
                    {product.grossWeightG ? formatWeight(product.grossWeightG) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Unit Weight</p>
                </div>
              </div>

              {/* Location */}
              {product.inventory?.location ? (
                <div className="flex items-center gap-3 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3">
                  <MapPin className="h-5 w-5 text-gold-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-gold-800">{product.inventory.location}</p>
                    <p className="text-xs text-gold-600">Storage location</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <p className="text-sm">No storage location set</p>
                </div>
              )}

              {/* Spec grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {product.metalType && (
                  <>
                    <span className="text-muted-foreground">Metal</span>
                    <span className="font-medium capitalize">{product.metalType}</span>
                  </>
                )}
                {product.purity && (
                  <>
                    <span className="text-muted-foreground">Purity</span>
                    <span className="font-medium font-mono">{product.purity}</span>
                  </>
                )}
                {product.grossWeightG && (
                  <>
                    <span className="text-muted-foreground">Gross Weight</span>
                    <span className="font-medium">{formatWeight(product.grossWeightG)}</span>
                  </>
                )}
                {product.netWeightG && (
                  <>
                    <span className="text-muted-foreground">Net Weight</span>
                    <span className="font-medium">{formatWeight(product.netWeightG)}</span>
                  </>
                )}
                {product.makingCharge && (
                  <>
                    <span className="text-muted-foreground">Making Charge</span>
                    <span className="font-medium">
                      {product.makingType === 'percentage'
                        ? `${product.makingCharge}%`
                        : product.makingType === 'per_gram'
                        ? `₹${product.makingCharge}/g`
                        : `₹${product.makingCharge} flat`}
                    </span>
                  </>
                )}
                {product.inventory?.minStockAlert > 0 && (
                  <>
                    <span className="text-muted-foreground">Low Stock Alert</span>
                    <span className="font-medium">{product.inventory.minStockAlert} units</span>
                  </>
                )}
              </div>

              {product.description && (
                <p className="text-sm text-muted-foreground border-t border-border pt-3">{product.description}</p>
              )}
            </div>
          </div>
        </Card>

        {/* ── Add Stock ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Add Stock</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Record incoming inventory</p>
              </div>
              <Button size="sm" variant="gold" onClick={() => setShowAddStock((v) => !v)}>
                <Plus className="h-4 w-4" /> Add Stock
              </Button>
            </div>
          </CardHeader>
          {showAddStock && (
            <CardContent>
              <form
                onSubmit={stockForm.handleSubmit((d) => addStockMutation.mutate(d))}
                className="rounded-lg border bg-secondary/40 p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity *</Label>
                    <Input {...stockForm.register('quantity')} type="number" min="1" placeholder="10" className="h-8 text-sm" />
                    {stockForm.formState.errors.quantity && (
                      <p className="text-xs text-destructive">{stockForm.formState.errors.quantity.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Weight Added (g)</Label>
                    <Input {...stockForm.register('weightG')} placeholder="125.000" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input {...stockForm.register('notes')} placeholder="Supplier / batch…" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setShowAddStock(false); stockForm.reset({ quantity: 1 }); }}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="gold" size="sm" disabled={addStockMutation.isPending}>
                    {addStockMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Update Stock
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>

        {/* ── Movement History ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Stock Movement History</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Last 50 movements</p>
          </CardHeader>
          <CardContent>
            {(movements as any[]).length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No movements recorded yet</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Weight</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(movements as any[]).map((m: any) => {
                      const qty = Number(m.quantity);
                      const isOut = m.movementType === 'out' || qty < 0;
                      return (
                        <tr key={m.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize',
                              isOut
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                            )}>
                              {m.movementType}
                            </span>
                          </td>
                          <td className={cn('px-3 py-2.5 text-xs font-semibold', qty >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                            {qty > 0 ? `+${qty}` : qty}
                          </td>
                          <td className="px-3 py-2.5 text-xs">{m.weightG ? formatWeight(m.weightG) : '—'}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">{m.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Related Products ── */}
        {(relatedProducts as any[]).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">More in {product.category?.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {(relatedProducts as any[]).map((rp: any) => {
                  const rpImg = rp.images?.find((i: any) => i.isPrimary) ?? rp.images?.[0];
                  const rpStock = rp.inventory?.quantity ?? 0;
                  return (
                    <div
                      key={rp.id}
                      className="cursor-pointer rounded-lg border overflow-hidden hover:shadow-md transition-shadow group"
                      onClick={() => navigate(`/products/${rp.id}`)}
                    >
                      <div className="aspect-square bg-secondary overflow-hidden">
                        {rpImg ? (
                          <img src={rpImg.url} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-gold-300">
                            <Gem className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium leading-tight line-clamp-2">{rp.name}</p>
                        {rp.sku && <p className="text-[10px] font-mono text-gold-600 mt-0.5">{rp.sku}</p>}
                        <p className={cn(
                          'text-[10px] font-semibold mt-1',
                          rpStock === 0 ? 'text-red-500' : rpStock <= 2 ? 'text-amber-500' : 'text-emerald-600',
                        )}>
                          {rpStock === 0 ? 'Out of stock' : `${rpStock} in stock`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this product?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{product.name}</strong> will be archived and removed from the catalog. Existing transaction records will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

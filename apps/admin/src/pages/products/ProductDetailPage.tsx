import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft, Pencil, Plus, Tag, Archive, Scale, Gem,
  ChevronLeft, ChevronRight, Trash2, Loader2, Package,
  Layers, AlertCircle, MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatWeight, cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const METAL_TAG: Record<string, string> = {
  gold:        'bg-amber-400 text-amber-950',
  silver:      'bg-slate-300 text-slate-900',
  platinum:    'bg-indigo-300 text-indigo-950',
  diamond:     'bg-cyan-300 text-cyan-950',
  'rose gold': 'bg-rose-300 text-rose-950',
  'white gold':'bg-blue-200 text-blue-900',
};
function getMetalBg(m: string) {
  return METAL_TAG[m?.toLowerCase()] ?? 'bg-purple-200 text-purple-900';
}

const PIECE_STATUS: Record<string, { label: string; cls: string }> = {
  in_stock:  { label: 'In Stock',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  sold:      { label: 'Sold',      cls: 'bg-red-100 text-red-700 border-red-200' },
  on_repair: { label: 'On Repair', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  on_hold:   { label: 'On Hold',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const addPieceSchema = z.object({
  tagNo: z.string().optional(),
  grossWeightG: z.string().optional(),
  netWeightG: z.string().optional(),
  purity: z.string().optional(),
  notes: z.string().optional(),
});
type AddPieceForm = z.infer<typeof addPieceSchema>;

const addStockSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'At least 1'),
  weightG: z.string().optional(),
  notes: z.string().optional(),
});
type AddStockForm = z.infer<typeof addStockSchema>;

function SpecRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  );
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [imgIdx, setImgIdx] = useState(0);
  const [showAddPiece, setShowAddPiece] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: pieces = [] } = useQuery({
    queryKey: ['pieces', id],
    queryFn: () => api.get(`/pieces?productId=${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['movements', id],
    queryFn: () => api.get(`/inventory/movements/log?limit=50`).then((r) => r.data.data.filter((m: any) => m.productId === id)),
    enabled: !!id,
  });

  // Reset image index when product changes
  useEffect(() => { setImgIdx(0); }, [id]);

  const pieceForm = useForm<AddPieceForm>({ resolver: zodResolver(addPieceSchema) });
  const stockForm = useForm<AddStockForm>({
    resolver: zodResolver(addStockSchema),
    defaultValues: { quantity: 1 },
  });

  const addPieceMutation = useMutation({
    mutationFn: (data: AddPieceForm) => api.post('/pieces', { ...data, productId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pieces', id] });
      qc.invalidateQueries({ queryKey: ['product', id] });
      toast({ variant: 'success', title: 'Piece added' });
      pieceForm.reset();
      setShowAddPiece(false);
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add piece' }),
  });

  const deletePieceMutation = useMutation({
    mutationFn: (pieceId: string) => api.delete(`/pieces/${pieceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pieces', id] });
      qc.invalidateQueries({ queryKey: ['product', id] });
      toast({ variant: 'success', title: 'Piece removed' });
    },
    onError: (err: any) =>
      toast({ variant: 'destructive', title: err?.response?.data?.error || 'Cannot delete piece' }),
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
          <Button variant="outline" onClick={() => navigate('/products')}>Back to Products</Button>
        </div>
      </div>
    );
  }

  const images: any[] = product.images ?? [];
  const isPerPiece = product.trackingType === 'per_piece';
  const stock = product.inventory?.quantity ?? 0;
  const isLow = stock <= (product.inventory?.minStockAlert ?? 0);
  const currentImg = images[imgIdx];
  const allPieces = pieces as any[];
  const inStockPieces = allPieces.filter((p) => p.status === 'in_stock');
  const soldPieces = allPieces.filter((p) => p.status === 'sold');

  function handleEdit() {
    // Navigate back to products list with state so it can open the edit dialog
    navigate('/products', { state: { editId: product.id } });
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={product.name}
        description={product.sku ? `SKU: ${product.sku}` : undefined}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/products')}>
              <ArrowLeft className="h-4 w-4" /> Products
            </Button>
            <Button variant="gold" size="sm" onClick={handleEdit}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Top row: image gallery + stock summary + specs ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Image Gallery */}
          <Card className="overflow-hidden">
            <div className="aspect-square relative bg-secondary">
              {currentImg ? (
                <img src={currentImg.url} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gold-200">
                  <Gem className="h-16 w-16" />
                </div>
              )}
              {product.metalType && (
                <span className={cn(
                  'absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-full capitalize shadow-sm',
                  getMetalBg(product.metalType)
                )}>
                  {product.metalType}
                </span>
              )}
              {images.length > 1 && (
                <>
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                    onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
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
              <div className="flex gap-1.5 p-2 flex-wrap bg-secondary/60 border-t border-border">
                {images.map((img: any, i: number) => (
                  <button
                    key={img.id}
                    onClick={() => setImgIdx(i)}
                    className={cn(
                      'h-11 w-11 rounded-md overflow-hidden border-2 transition-all',
                      i === imgIdx ? 'border-gold-500' : 'border-transparent opacity-50 hover:opacity-80'
                    )}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {images.length === 0 && (
              <div className="px-3 pb-3 pt-1">
                <p className="text-xs text-muted-foreground text-center">No photos uploaded</p>
              </div>
            )}
          </Card>

          {/* Stock Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stock Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main stock count */}
              <div className={cn(
                'rounded-xl p-4 flex items-center gap-3',
                stock === 0
                  ? 'bg-red-50 border border-red-200'
                  : isLow
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-emerald-50 border border-emerald-200'
              )}>
                <Layers className={cn(
                  'h-8 w-8 shrink-0',
                  stock === 0 ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                )} />
                <div>
                  <p className={cn(
                    'text-3xl font-heading font-bold leading-none',
                    stock === 0 ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-emerald-700'
                  )}>
                    {stock}
                  </p>
                  <p className={cn(
                    'text-sm mt-0.5',
                    stock === 0 ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'
                  )}>
                    {isPerPiece ? 'pieces in stock' : 'units in stock'}
                    {stock === 0 ? ' — Out of stock' : isLow ? ' — Low stock' : ''}
                  </p>
                </div>
              </div>

              {/* Weight for template */}
              {!isPerPiece && product.inventory?.totalWeightG && (
                <div className="flex items-center gap-2.5 border rounded-lg px-3 py-2.5 bg-secondary/30">
                  <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-sm font-semibold">{formatWeight(product.inventory.totalWeightG)}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">total weight in stock</span>
                  </div>
                </div>
              )}

              {/* Per-piece mini stats */}
              {isPerPiece && (
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-2.5">
                    <p className="text-xl font-bold text-emerald-700">{inStockPieces.length}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">In Stock</p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 py-2.5">
                    <p className="text-xl font-bold text-red-700">{soldPieces.length}</p>
                    <p className="text-[10px] text-red-600 mt-0.5">Sold</p>
                  </div>
                  <div className="rounded-lg bg-secondary border py-2.5">
                    <p className="text-xl font-bold">{allPieces.length}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
                  </div>
                </div>
              )}

              {/* Location */}
              {product.inventory?.location && (
                <div className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-secondary/30">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{product.inventory.location}</span>
                  <span className="text-xs text-muted-foreground ml-1">Storage location</span>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={cn(
                  'text-xs gap-1',
                  isPerPiece
                    ? 'border-amber-300 text-amber-700 bg-amber-50'
                    : 'border-slate-300 text-slate-600 bg-slate-50'
                )}>
                  {isPerPiece ? <Tag className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                  {isPerPiece ? 'Per Piece' : 'Template / Bulk'}
                </Badge>
                {product.category && <Badge variant="outline" className="text-xs">{product.category.name}</Badge>}
                {product.purity && <Badge variant="secondary" className="text-xs font-mono">{product.purity}</Badge>}
              </div>

              {product.inventory?.minStockAlert > 0 && (
                <p className="text-xs text-muted-foreground">
                  Alert threshold: <span className="font-semibold">{product.inventory.minStockAlert}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Specs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Specifications</CardTitle>
            </CardHeader>
            <CardContent>
              <SpecRow label="Metal" value={product.metalType} />
              <SpecRow label="Purity" value={product.purity} />
              <SpecRow label="Gross Weight" value={product.grossWeightG ? formatWeight(product.grossWeightG) : null} />
              <SpecRow label="Net Weight" value={product.netWeightG ? formatWeight(product.netWeightG) : null} />
              <SpecRow label="Stone Type" value={product.stoneType} />
              <SpecRow
                label="Stone Weight"
                value={product.stoneWeightCt ? `${product.stoneWeightCt} ct` : null}
              />
              <SpecRow
                label="Making Charge"
                value={
                  product.makingCharge
                    ? `₹${product.makingCharge}${product.makingType === 'per_gram' ? '/g' : product.makingType === 'percentage' ? '%' : ' flat'}`
                    : null
                }
              />
              {!product.metalType && !product.purity && !product.grossWeightG && (
                <p className="text-sm text-muted-foreground text-center py-4">No specifications recorded</p>
              )}
              {product.description && (
                <div className="pt-3 border-t border-border mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{product.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Per-Piece: Individual Pieces Table ── */}
        {isPerPiece && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Individual Pieces</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Each physical piece tracked separately · {inStockPieces.length} in stock
                  </p>
                </div>
                <Button size="sm" variant="gold" onClick={() => setShowAddPiece((v) => !v)}>
                  <Plus className="h-4 w-4" /> Add Piece
                </Button>
              </div>
            </CardHeader>
            <CardContent>

              {/* Add Piece Form */}
              {showAddPiece && (
                <form
                  onSubmit={pieceForm.handleSubmit((d) => addPieceMutation.mutate(d))}
                  className="mb-5 p-4 rounded-lg border border-border bg-secondary/40 space-y-3"
                >
                  <p className="text-sm font-semibold">New Piece Details</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tag / Label No.</Label>
                      <Input {...pieceForm.register('tagNo')} placeholder="PC-001" className="h-8 text-sm font-mono" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gross Weight (g)</Label>
                      <Input {...pieceForm.register('grossWeightG')} placeholder="12.500" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Net Weight (g)</Label>
                      <Input {...pieceForm.register('netWeightG')} placeholder="11.200" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Purity Override</Label>
                      <Input {...pieceForm.register('purity')} placeholder={product.purity || '22K'} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input {...pieceForm.register('notes')} placeholder="Any notes…" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowAddPiece(false); pieceForm.reset(); }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="gold" size="sm" disabled={addPieceMutation.isPending}>
                      {addPieceMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Add Piece
                    </Button>
                  </div>
                </form>
              )}

              {allPieces.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Tag className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No pieces yet. Click "Add Piece" to start tracking individual items.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">#</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Tag No.</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Gross Wt</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Net Wt</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Purity</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Notes</th>
                        <th className="px-3 py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allPieces.map((piece: any, idx: number) => {
                        const st = PIECE_STATUS[piece.status] ?? { label: piece.status, cls: 'bg-secondary text-muted-foreground border-border' };
                        return (
                          <tr key={piece.id} className="hover:bg-muted/20">
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-mono text-xs font-semibold text-gold-700">
                              {piece.tagNo || <span className="text-muted-foreground font-normal">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-xs">
                              {piece.grossWeightG ? formatWeight(piece.grossWeightG) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-xs">
                              {piece.netWeightG ? formatWeight(piece.netWeightG) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-xs font-mono">
                              {piece.purity || product.purity || '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={cn(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                                st.cls
                              )}>
                                {st.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[140px] truncate">
                              {piece.notes || '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              {piece.status === 'in_stock' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deletePieceMutation.mutate(piece.id)}
                                  disabled={deletePieceMutation.isPending}
                                  title="Remove piece"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Template: Stock Management ── */}
        {!isPerPiece && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Stock Management</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add received stock — quantity and weight
                  </p>
                </div>
                <Button size="sm" variant="gold" onClick={() => setShowAddStock((v) => !v)}>
                  <Plus className="h-4 w-4" /> Add Stock
                </Button>
              </div>
            </CardHeader>
            <CardContent>

              {/* Current summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                <div className="rounded-lg border bg-secondary/30 px-4 py-3 text-center">
                  <p className="text-2xl font-heading font-bold">{stock}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Units in stock</p>
                </div>
                <div className="rounded-lg border bg-secondary/30 px-4 py-3 text-center">
                  <p className="text-lg font-heading font-semibold">
                    {product.inventory?.totalWeightG ? formatWeight(product.inventory.totalWeightG) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total weight</p>
                </div>
                <div className="rounded-lg border bg-secondary/30 px-4 py-3 text-center">
                  <p className="text-lg font-heading font-semibold">
                    {product.grossWeightG ? formatWeight(product.grossWeightG) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Unit weight</p>
                </div>
              </div>

              {/* Add stock form */}
              {showAddStock && (
                <form
                  onSubmit={stockForm.handleSubmit((d) => addStockMutation.mutate(d))}
                  className="p-4 rounded-lg border border-border bg-secondary/40 space-y-3"
                >
                  <p className="text-sm font-semibold">Receive New Stock</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity to Add *</Label>
                      <Input
                        {...stockForm.register('quantity')}
                        type="number"
                        min="1"
                        placeholder="10"
                        className="h-8 text-sm"
                      />
                      {stockForm.formState.errors.quantity && (
                        <p className="text-xs text-destructive">{stockForm.formState.errors.quantity.message}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Total Weight Added (g)</Label>
                      <Input
                        {...stockForm.register('weightG')}
                        placeholder="125.000"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        {...stockForm.register('notes')}
                        placeholder="Supplier / batch info…"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowAddStock(false); stockForm.reset({ quantity: 1 }); }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="gold" size="sm" disabled={addStockMutation.isPending}>
                      {addStockMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Update Stock
                    </Button>
                  </div>
                </form>
              )}

              {!showAddStock && (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Click "Add Stock" to record incoming inventory</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Stock Movement History ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Stock Movement History</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Last 50 movements for this product</p>
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
                      const typeCls =
                        m.movementType === 'sale'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : m.movementType === 'purchase'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-secondary text-muted-foreground border-border';
                      const qty = Number(m.quantity);
                      const qtyLabel = qty > 0 ? `+${qty}` : String(qty);
                      return (
                        <tr key={m.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize',
                              typeCls
                            )}>
                              {m.movementType}
                            </span>
                          </td>
                          <td className={cn(
                            'px-3 py-2.5 text-xs font-semibold',
                            qty > 0 ? 'text-emerald-700' : qty < 0 ? 'text-red-700' : 'text-muted-foreground'
                          )}>
                            {qtyLabel}
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {m.weightG ? formatWeight(m.weightG) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                            {m.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

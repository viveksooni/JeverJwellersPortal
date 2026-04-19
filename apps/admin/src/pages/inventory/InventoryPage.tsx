import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, Package, Loader2, Search, Plus, Trash2,
  ChevronDown, ChevronRight, Tag, Scale,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatWeight, formatDate, cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// ─── Piece status pill ────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  in_stock:  'bg-emerald-100 text-emerald-800 border-emerald-300',
  sold:      'bg-gray-100 text-gray-500 border-gray-300',
  on_repair: 'bg-amber-100 text-amber-800 border-amber-300',
  on_hold:   'bg-blue-100 text-blue-800 border-blue-300',
};

// ─── Add Piece Dialog ─────────────────────────────────────────────────────────

const addPieceSchema = z.object({
  tagNo:        z.string().optional(),
  grossWeightG: z.string().min(1, 'Required'),
  netWeightG:   z.string().optional(),
  purity:       z.string().optional(),
  notes:        z.string().optional(),
});
type AddPieceForm = z.infer<typeof addPieceSchema>;

function AddPieceDialog({ open, onClose, product }: { open: boolean; onClose: () => void; product: any }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddPieceForm>({
    resolver: zodResolver(addPieceSchema),
    defaultValues: {
      purity: product?.purity ?? '',
      grossWeightG: product?.grossWeightG ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: AddPieceForm) =>
      api.post('/pieces', { ...data, productId: product.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['pieces', product.id] });
      toast({ variant: 'success', title: 'Piece added' });
      reset();
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add piece' }),
  });

  if (!product) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Piece — {product.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tag No <span className="text-muted-foreground text-xs">(auto if blank)</span></Label>
            <Input {...register('tagNo')} placeholder={`${product.sku}-P01`} className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Gross Weight (g) *</Label>
              <Input {...register('grossWeightG')} placeholder="5.180" />
              {errors.grossWeightG && <p className="text-xs text-destructive">{errors.grossWeightG.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Net Weight (g)</Label>
              <Input {...register('netWeightG')} placeholder="4.850" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Purity</Label>
            <Input {...register('purity')} placeholder="e.g. 22K" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input {...register('notes')} placeholder="Any notes…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Piece
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pieces Expanded Row ──────────────────────────────────────────────────────

function PiecesRow({ product }: { product: any }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: pieces = [], isLoading } = useQuery({
    queryKey: ['pieces', product.id],
    queryFn: () => api.get(`/pieces?productId=${product.id}`).then((r) => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (pieceId: string) => api.delete(`/pieces/${pieceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pieces', product.id] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast({ variant: 'success', title: 'Piece removed' });
    },
    onError: (err: any) =>
      toast({ variant: 'destructive', title: err?.response?.data?.error ?? 'Cannot delete piece' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/pieces/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pieces', product.id] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const inStock = pieces.filter((p: any) => p.status === 'in_stock').length;

  return (
    <tr>
      <td colSpan={8} className="px-0 pb-2">
        <div className="mx-4 rounded-lg border border-gold-200 bg-gold-50/60">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gold-200">
            <div className="flex items-center gap-3 text-sm">
              <Tag className="h-4 w-4 text-gold-600" />
              <span className="font-semibold text-gold-800">Individual Pieces</span>
              <Badge variant="outline" className="text-[11px] font-mono">
                {inStock}/{pieces.length} in stock
              </Badge>
            </div>
            <Button size="sm" variant="gold" className="h-7 gap-1.5" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Piece
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading pieces…
            </div>
          ) : pieces.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No pieces added yet — click "Add Piece" to register individual pieces.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left px-4 py-1.5 font-semibold">Tag No</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Gross Wt</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Net Wt</th>
                  <th className="text-left px-3 py-1.5 font-semibold">Purity</th>
                  <th className="text-left px-3 py-1.5 font-semibold">Status</th>
                  <th className="text-left px-3 py-1.5 font-semibold">Notes</th>
                  <th className="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-100">
                {pieces.map((piece: any) => (
                  <tr key={piece.id} className="hover:bg-gold-50">
                    <td className="px-4 py-2 font-mono font-semibold text-gold-700">
                      {piece.tagNo ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {piece.grossWeightG ? `${parseFloat(piece.grossWeightG).toFixed(3)}g` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {piece.netWeightG ? `${parseFloat(piece.netWeightG).toFixed(3)}g` : '—'}
                    </td>
                    <td className="px-3 py-2">{piece.purity ?? '—'}</td>
                    <td className="px-3 py-2">
                      {piece.status === 'in_stock' ? (
                        <Select
                          value={piece.status}
                          onValueChange={(v) => statusMutation.mutate({ id: piece.id, status: v })}
                        >
                          <SelectTrigger className="h-6 text-[11px] w-28 border-0 bg-transparent p-0 focus:ring-0">
                            <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-medium', STATUS_STYLE[piece.status])}>
                              {piece.status.replace('_', ' ')}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in_stock">In Stock</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="on_repair">On Repair</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-medium', STATUS_STYLE[piece.status] ?? '')}>
                          {piece.status.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">
                      {piece.notes ?? ''}
                    </td>
                    <td className="px-3 py-2">
                      {piece.status === 'in_stock' && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(piece.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <AddPieceDialog open={showAdd} onClose={() => setShowAdd(false)} product={product} />
      </td>
    </tr>
  );
}

// ─── Adjust Dialog (template products) ───────────────────────────────────────

const adjustSchema = z.object({
  quantity: z.coerce.number().int(),
  weightG: z.string().optional(),
  notes: z.string().optional(),
  location: z.string().optional(),
  minStockAlert: z.coerce.number().int().optional(),
});
type AdjustForm = z.infer<typeof adjustSchema>;

function AdjustDialog({ open, onClose, item }: { open: boolean; onClose: () => void; item: any }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { quantity: 0, minStockAlert: item?.minStockAlert, location: item?.location ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (data: AdjustForm) => api.patch(`/inventory/${item.productId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast({ variant: 'success', title: 'Stock adjusted' });
      reset();
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: 'Adjustment failed' }),
  });

  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust Stock — {item.product?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="rounded-lg bg-secondary p-3 text-sm">
            Current stock: <strong>{item.quantity}</strong> units ·{' '}
            <strong>{formatWeight(item.totalWeightG)}</strong>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity Change (+ to add, - to deduct)</Label>
            <Input type="number" {...register('quantity')} placeholder="e.g. 5 or -2" />
          </div>
          <div className="space-y-1.5">
            <Label>Weight (g) to add/deduct</Label>
            <Input {...register('weightG')} placeholder="e.g. 12.500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input {...register('location')} placeholder="Showcase A" />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stock Alert</Label>
              <Input type="number" {...register('minStockAlert')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input {...register('notes')} placeholder="Reason for adjustment" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function InventoryPage() {
  const [searchParams] = useSearchParams();
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(() => searchParams.get('lowStock') === 'true');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [metalFilter, setMetalFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [trackingFilter, setTrackingFilter] = useState('all');

  const { data = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then((r) => r.data.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
  });

  const { data: metalTypes = [] } = useQuery({
    queryKey: ['metal-types'],
    queryFn: () => api.get('/settings/metal-types').then((r) => r.data.data),
  });

  const filtered = data.filter((item: any) => {
    const p = item.product;
    if (!p) return false;
    const matchSearch = !search
      || p.name?.toLowerCase().includes(search.toLowerCase())
      || p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchLow = !showLowOnly || item.quantity <= item.minStockAlert;
    const matchMetal = metalFilter === 'all' || p.metalType === metalFilter;
    const matchCategory = categoryFilter === 'all' || String(p.categoryId) === categoryFilter;
    const matchTracking = trackingFilter === 'all' || p.trackingType === trackingFilter;
    return matchSearch && matchLow && matchMetal && matchCategory && matchTracking;
  });

  const lowStockCount = data.filter((item: any) => item.quantity <= item.minStockAlert).length;

  const hasActiveFilters = metalFilter !== 'all' || categoryFilter !== 'all' || trackingFilter !== 'all' || showLowOnly;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Inventory"
        description="Stock levels across all products"
        action={
          <div className="flex items-center gap-2">
            {lowStockCount > 0 && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {lowStockCount} low stock
              </Badge>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filter row */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search product or SKU…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={metalFilter} onValueChange={setMetalFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Metal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Metals</SelectItem>
              {metalTypes.map((m: any) => (
                <SelectItem key={m.name} value={m.name}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={trackingFilter} onValueChange={setTrackingFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Tracking" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tracking</SelectItem>
              <SelectItem value="per_piece">Per Piece</SelectItem>
              <SelectItem value="template">Template</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showLowOnly ? 'gold' : 'outline'}
            size="sm"
            onClick={() => setShowLowOnly(!showLowOnly)}
          >
            <AlertTriangle className="h-4 w-4" /> Low Stock
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setMetalFilter('all');
                setCategoryFilter('all');
                setTrackingFilter('all');
                setShowLowOnly(false);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-8" />
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Metal</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Qty</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total Weight</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Location</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item: any) => {
                const isLow = item.quantity <= item.minStockAlert;
                const isPerPiece = item.product?.trackingType === 'per_piece';
                const isExpanded = expandedId === item.id;

                return (
                  <>
                    <tr
                      key={item.id}
                      className={cn(isLow ? 'bg-amber-50' : 'hover:bg-muted/40', isExpanded && 'bg-gold-50/40')}
                    >
                      <td className="px-2 py-3 w-8">
                        {isPerPiece && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.product?.images?.[0] && (
                            <img src={item.product.images[0].url} alt="" className="h-8 w-8 rounded object-cover" />
                          )}
                          <div>
                            <p className="font-medium">{item.product?.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {item.product?.sku && (
                                <span className="text-[10px] font-mono text-gold-600">{item.product.sku}</span>
                              )}
                              {isPerPiece && (
                                <span className="text-[10px] bg-gold-100 text-gold-700 border border-gold-200 rounded px-1 font-semibold">
                                  Per Piece
                                </span>
                              )}
                              {item.product?.purity && (
                                <span className="text-xs text-muted-foreground">{item.product.purity}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {item.product?.category?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.product?.metalType ? (
                          <span className="text-xs capitalize text-muted-foreground">{item.product.metalType}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${isLow ? 'text-amber-600' : 'text-foreground'}`}>
                          {item.quantity}
                        </span>
                        {isLow && <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 ml-1" />}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatWeight(item.totalWeightG)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {item.location ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPerPiece ? (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          >
                            <Tag className="h-3 w-3" />
                            {isExpanded ? 'Hide' : 'Pieces'}
                          </Button>
                        ) : (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setAdjustItem(item)}
                          >
                            Adjust
                          </Button>
                        )}
                      </td>
                    </tr>

                    {isPerPiece && isExpanded && (
                      <PiecesRow key={`pieces-${item.id}`} product={item.product} />
                    )}
                  </>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No inventory records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdjustDialog
        open={!!adjustItem}
        onClose={() => setAdjustItem(null)}
        item={adjustItem}
      />
    </div>
  );
}

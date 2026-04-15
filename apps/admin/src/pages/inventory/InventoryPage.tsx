import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Package, ArrowUp, ArrowDown, Loader2, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatWeight, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

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
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
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

export function InventoryPage() {
  const [searchParams] = useSearchParams();
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(() => searchParams.get('lowStock') === 'true');

  const { data = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then((r) => r.data.data),
  });

  const filtered = data.filter((item: any) => {
    const matchSearch = !search || item.product?.name?.toLowerCase().includes(search.toLowerCase());
    const matchLow = !showLowOnly || item.quantity <= item.minStockAlert;
    return matchSearch && matchLow;
  });

  const lowStockCount = data.filter((item: any) => item.quantity <= item.minStockAlert).length;

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
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={showLowOnly ? 'gold' : 'outline'}
            size="sm"
            onClick={() => setShowLowOnly(!showLowOnly)}
          >
            <AlertTriangle className="h-4 w-4" /> Low Stock Only
          </Button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Category</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Qty</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total Weight</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Location</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Updated</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item: any) => {
                const isLow = item.quantity <= item.minStockAlert;
                return (
                  <tr key={item.id} className={isLow ? 'bg-amber-50' : 'hover:bg-muted/40'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.product?.images?.[0] && (
                          <img
                            src={item.product.images[0].url}
                            alt=""
                            className="h-8 w-8 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium">{item.product?.name}</p>
                          {item.product?.purity && (
                            <p className="text-xs text-muted-foreground">{item.product.purity}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.product?.category?.name ?? '-'}
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
                      {item.location ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {formatDate(item.lastUpdated)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setAdjustItem(item)}
                      >
                        Adjust
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
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

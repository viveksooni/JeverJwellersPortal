import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Gem, Tag, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatWeight, cn } from '@/lib/utils';

const METAL_TAG: Record<string, { bg: string }> = {
  gold:        { bg: 'bg-amber-400 text-amber-950' },
  silver:      { bg: 'bg-slate-300 text-slate-900' },
  platinum:    { bg: 'bg-indigo-300 text-indigo-950' },
  diamond:     { bg: 'bg-cyan-300 text-cyan-950' },
  'rose gold': { bg: 'bg-rose-300 text-rose-950' },
  'white gold':{ bg: 'bg-blue-200 text-blue-900' },
};

function getMetalBg(metal: string) {
  return METAL_TAG[metal?.toLowerCase()]?.bg ?? 'bg-purple-200 text-purple-900';
}

export function ProductsByCategoryPage() {
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
    staleTime: 300_000,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'all-for-category'],
    queryFn: () => api.get('/products?limit=500').then((r) => r.data.data ?? []),
    staleTime: 60_000,
  });

  const allProducts: any[] = productsData ?? [];

  // Group products by category
  const grouped: Map<string, { category: any; products: any[] }> = new Map();

  // First, add all categories (even empty ones)
  for (const cat of categories as any[]) {
    grouped.set(String(cat.id), { category: cat, products: [] });
  }

  // Add "Uncategorized" group
  grouped.set('none', { category: { id: 'none', name: 'Uncategorized', skuPrefix: null, trackingType: null }, products: [] });

  // Place products into their category groups, filtered by search
  for (const p of allProducts) {
    const key = p.categoryId ? String(p.categoryId) : 'none';
    const matchSearch = !search
      || p.name?.toLowerCase().includes(search.toLowerCase())
      || p.sku?.toLowerCase().includes(search.toLowerCase())
      || p.purity?.toLowerCase().includes(search.toLowerCase());
    if (matchSearch && grouped.has(key)) {
      grouped.get(key)!.products.push(p);
    }
  }

  // Remove empty groups (when search active, show only groups with results)
  const entries = Array.from(grouped.values()).filter((g) =>
    search ? g.products.length > 0 : g.category.id !== 'none' || g.products.length > 0
  );

  function toggleCategory(id: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isLoading = catsLoading || productsLoading;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Catalog by Category"
        description={`${allProducts.length} products across ${(categories as any[]).length} categories`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product, SKU, purity…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && (
          <div className="text-center py-16 text-muted-foreground">Loading catalog…</div>
        )}

        {/* Category sections */}
        {entries.map(({ category, products }) => {
          const isCollapsed = collapsedCategories.has(String(category.id));
          const perPieceCount = products.filter((p) => p.trackingType === 'per_piece').length;
          const templateCount = products.filter((p) => p.trackingType !== 'per_piece').length;
          const totalStock = products.reduce((s: number, p: any) => s + (p.inventory?.quantity ?? 0), 0);

          return (
            <Card key={category.id} className="overflow-hidden">
              {/* Category header */}
              <CardHeader
                className="cursor-pointer py-3 px-4 hover:bg-muted/30 transition-colors"
                onClick={() => toggleCategory(String(category.id))}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button className="text-muted-foreground shrink-0">
                      {isCollapsed
                        ? <ChevronRight className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{category.name}</CardTitle>
                        {category.skuPrefix && (
                          <span className="text-xs font-mono font-semibold text-gold-700 bg-gold-50 border border-gold-200 rounded px-1.5 py-0.5">
                            {category.skuPrefix}
                          </span>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <Badge variant="outline" className="text-xs">{products.length} products</Badge>
                    {perPieceCount > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 bg-amber-50">
                        <Tag className="h-3 w-3" />{perPieceCount} per piece
                      </Badge>
                    )}
                    {templateCount > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-slate-300 text-slate-600 bg-slate-50">
                        <Archive className="h-3 w-3" />{templateCount} bulk
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {totalStock} in stock
                    </span>
                  </div>
                </div>
              </CardHeader>

              {/* Products grid */}
              {!isCollapsed && (
                <CardContent className="pt-0 pb-4">
                  {products.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <Gem className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      No products in this category yet
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mt-2">
                      {products.map((p: any) => {
                        const primaryImg = p.images?.find((i: any) => i.isPrimary) ?? p.images?.[0];
                        const isPerPiece = p.trackingType === 'per_piece';
                        const stock = p.inventory?.quantity ?? 0;
                        const isLow = stock <= (p.inventory?.minStockAlert ?? 0);

                        return (
                          <div
                            key={p.id}
                            className={cn(
                              'rounded-lg border overflow-hidden hover:shadow-sm transition-shadow bg-card',
                              isLow && stock === 0 ? 'border-red-200' : isLow ? 'border-amber-200' : 'border-border',
                            )}
                          >
                            {/* Image */}
                            <div className="aspect-square bg-secondary relative">
                              {primaryImg ? (
                                <img src={primaryImg.url} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-gold-200">
                                  <Gem className="h-8 w-8" />
                                </div>
                              )}
                              {p.metalType && (
                                <span className={cn(
                                  'absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize shadow-sm',
                                  getMetalBg(p.metalType),
                                )}>
                                  {p.metalType}
                                </span>
                              )}
                            </div>

                            {/* Info */}
                            <div className="p-2 space-y-1">
                              <p className="text-xs font-medium leading-tight line-clamp-2">{p.name}</p>
                              {p.sku && (
                                <p className="text-[10px] font-mono text-gold-600">{p.sku}</p>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {p.purity && (
                                  <Badge variant="secondary" className="text-[9px] py-0 px-1">{p.purity}</Badge>
                                )}
                              </div>
                              {p.grossWeightG && (
                                <p className="text-[10px] text-muted-foreground">{formatWeight(p.grossWeightG)}</p>
                              )}
                              <div className="flex items-center justify-between pt-0.5">
                                <span className={cn(
                                  'text-[10px] font-semibold',
                                  stock === 0 ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600',
                                )}>
                                  {isPerPiece ? `${stock} pcs` : `Qty: ${stock}`}
                                </span>
                                {isPerPiece ? (
                                  <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1">
                                    Per Piece
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-slate-50 text-slate-500 border border-slate-200 rounded px-1">
                                    Bulk
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        {!isLoading && entries.length === 0 && search && (
          <div className="text-center py-16 text-muted-foreground">
            <Gem className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-heading">No products match "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

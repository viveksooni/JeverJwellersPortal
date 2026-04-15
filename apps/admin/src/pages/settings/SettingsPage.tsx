import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Upload, Loader2, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { METAL_RATE_KEYS, METAL_RATE_LABELS } from '@jever/shared';
import { toast } from '@/hooks/use-toast';

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
          {/* Logo upload */}
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

function MetalRatesSection() {
  const qc = useQueryClient();
  const [metal, setMetal] = useState<string>(METAL_RATE_KEYS[0]);
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: todayRates = {} } = useQuery({
    queryKey: ['rates', 'today'],
    queryFn: () => api.get('/rates/today').then((r) => r.data.data),
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ['rates', 'upcoming'],
    queryFn: () => api.get('/rates/upcoming').then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: () => api.post('/rates', { metalType: metal, ratePerGram: rate, effectiveDate: date }),
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

  const today = new Date().toISOString().split('T')[0];
  const isFuture = date > today;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Metal Rates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Today's rates grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {METAL_RATE_KEYS.map((key) => (
            <div key={key} className="rounded-lg border border-gold-200 bg-gold-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-600">
                {METAL_RATE_LABELS[key]}
              </p>
              <p className="text-lg font-heading font-bold text-foreground mt-1">
                {todayRates[key] ? `₹${parseFloat(todayRates[key]).toLocaleString('en-IN')}` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">per gram</p>
            </div>
          ))}
        </div>

        {/* Add / Schedule rate */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">
            {isFuture ? (
              <span className="flex items-center gap-1.5 text-blue-700"><Calendar className="h-4 w-4" /> Schedule Future Rate</span>
            ) : 'Update Rate'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Metal</Label>
              <Select value={metal} onValueChange={setMetal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METAL_RATE_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>{METAL_RATE_LABELS[k]}</SelectItem>
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
          <Button variant={isFuture ? 'outline' : 'gold'} size="sm" onClick={() => mutation.mutate()} disabled={!rate || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isFuture ? '📅 Schedule Rate' : 'Set Rate'}
          </Button>
        </div>

        {/* Upcoming / Scheduled rates */}
        {upcoming.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Scheduled Future Rates</p>
            <div className="space-y-2">
              {upcoming.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                  <span className="font-medium">{METAL_RATE_LABELS[r.metalType as keyof typeof METAL_RATE_LABELS]}</span>
                  <span>₹{parseFloat(r.ratePerGram).toLocaleString('en-IN')}/g</span>
                  <Badge variant="info">From {r.effectiveDate}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(r.id)}
                  >
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

export function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" description="Shop configuration and metal rates" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <ShopSettingsForm />
        <MetalRatesSection />
      </div>
    </div>
  );
}

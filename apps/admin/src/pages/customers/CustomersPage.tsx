import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Phone, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatDate, formatCurrency, getInitials } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function CustomerForm({ open, onClose, customer }: { open: boolean; onClose: () => void; customer?: any }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: customer ?? {},
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      customer
        ? api.put(`/customers/${customer.id}`, data)
        : api.post('/customers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ variant: 'success', title: customer ? 'Customer updated' : 'Customer added' });
      reset();
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to save customer' }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input {...register('name')} placeholder="Customer name" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register('phone')} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register('email')} type="email" placeholder="email@example.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input {...register('address')} placeholder="Full address" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input {...register('notes')} placeholder="Any notes…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {customer ? 'Update' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api.get(`/customers?search=${search}&limit=50`).then((r) => r.data),
    staleTime: 30_000,
  });

  const customers = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Customers"
        description={`${data?.total ?? 0} total customers`}
        action={
          <Button variant="gold" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Customer grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((c: any) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gold-gradient text-white text-sm font-semibold">
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{c.name}</p>
                    {c.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </p>
                    )}
                    {c.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {c.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Since {formatDate(c.createdAt)}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => { setEditCustomer(c); setShowForm(true); }}
                    >
                      Edit
                    </Button>
                    <Link to={`/customers/${c.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                        View <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && customers.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <p className="text-lg font-heading">No customers found</p>
              <p className="text-sm mt-1">Add your first customer to get started</p>
            </div>
          )}
        </div>
      </div>

      <CustomerForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditCustomer(null); }}
        customer={editCustomer}
      />
    </div>
  );
}

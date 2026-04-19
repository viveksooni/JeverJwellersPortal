import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, Eye, Pencil, Trash2, Loader2, Phone, Mail, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatDate, getInitials } from '@/lib/utils';
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
  });

  // Prefill form when editing or clear when adding
  useEffect(() => {
    if (open) {
      if (customer) {
        reset({
          name: customer.name ?? '',
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          address: customer.address ?? '',
          notes: customer.notes ?? '',
        });
      } else {
        reset({ name: '', phone: '', email: '', address: '', notes: '' });
      }
    }
  }, [open, customer, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      customer
        ? api.put(`/customers/${customer.id}`, data)
        : api.post('/customers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ variant: 'success', title: customer ? 'Customer updated' : 'Customer added' });
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
            <Input {...register('name')} placeholder="Customer name" autoFocus />
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
              {customer ? 'Update Customer' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [sinceFilter, setSinceFilter] = useState('all'); // all, week, month, year
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api.get(`/customers?search=${search}&limit=200`).then((r) => r.data),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ variant: 'success', title: 'Customer removed' });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: err?.response?.data?.error ?? 'Failed to delete customer' });
    },
  });

  const allCustomers: any[] = data?.data ?? [];

  // Client-side date filter
  const customers = allCustomers.filter((c) => {
    if (sinceFilter === 'all') return true;
    const created = new Date(c.createdAt);
    const now = new Date();
    if (sinceFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return created >= weekAgo;
    }
    if (sinceFilter === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
      return created >= monthAgo;
    }
    if (sinceFilter === 'year') {
      const yearAgo = new Date(now); yearAgo.setFullYear(now.getFullYear() - 1);
      return created >= yearAgo;
    }
    return true;
  });

  const columns: ColumnDef<any>[] = [
    {
      id: 'avatar',
      header: '',
      cell: ({ row }) => (
        <div className="flex h-8 w-8 items-center justify-center rounded-full gold-gradient text-white text-xs font-semibold shrink-0">
          {getInitials(row.original.name)}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3" /> {row.original.phone}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) =>
        row.original.email ? (
          <span className="text-sm flex items-center gap-1 text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> {row.original.email}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground max-w-[160px] truncate block">
          {row.original.address || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Since',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Link to={`/customers/${row.original.id}`}>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="View details">
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            title="Edit customer"
            onClick={() => { setEditCustomer(row.original); setShowForm(true); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete customer"
            onClick={() => setDeleteTarget(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Customers"
        description={`${data?.total ?? 0} total customers`}
        action={
          <Button variant="gold" size="sm" onClick={() => { setEditCustomer(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or email…"
              className="pl-9 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sinceFilter} onValueChange={setSinceFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          {customers.length !== allCustomers.length && (
            <Badge variant="outline" className="text-xs">
              Showing {customers.length} of {allCustomers.length}
            </Badge>
          )}
        </div>

        {/* Table */}
        {!isLoading && customers.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-heading">No customers found</p>
            <p className="text-sm mt-1">Add your first customer to get started</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={customers}
            isLoading={isLoading}
            pageSize={15}
            globalFilter={search}
          />
        )}
      </div>

      <CustomerForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditCustomer(null); }}
        customer={editCustomer}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be permanently removed. Their past transaction records will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

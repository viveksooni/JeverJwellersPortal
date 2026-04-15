import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, Phone, Mail, MapPin, Edit2, Loader2,
  Receipt, IndianRupee, ShoppingCart, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/lib/api';
import { formatCurrency, formatDateTime, formatDate, getInitials } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { TRANSACTION_TYPE_LABELS } from '@jever/shared';

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const TYPE_VARIANTS: Record<string, 'gold' | 'info' | 'warning' | 'secondary' | 'outline'> = {
  sale: 'gold', purchase: 'secondary', repair: 'info', exchange: 'warning', custom_order: 'outline',
};
const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'info' | 'destructive' | 'secondary'> = {
  completed: 'success', in_progress: 'info', pending: 'warning', cancelled: 'destructive',
};

function EditCustomerDialog({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: any }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      address: customer?.address ?? '',
      notes: customer?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.put(`/customers/${customer.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', customer.id] });
      toast({ variant: 'success', title: 'Customer updated' });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: 'Update failed' }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register('phone')} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register('email')} type="email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input {...register('address')} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [showEdit, setShowEdit] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: txnsData } = useQuery({
    queryKey: ['customer-txns', id],
    queryFn: () => api.get(`/customers/${id}/transactions`).then((r) => r.data),
    enabled: !!id,
  });

  const transactions = txnsData?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Customer not found.</p>
        <Link to="/customers"><Button variant="outline" className="mt-3">Back to Customers</Button></Link>
      </div>
    );
  }

  const totalSpent = parseFloat(customer.totalSpent ?? '0');
  const totalTxns = parseInt(customer.totalTransactions ?? '0');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/customers">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-xl font-semibold">{customer.name}</h1>
            <p className="text-xs text-muted-foreground">Customer since {formatDate(customer.createdAt)}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
          <Edit2 className="h-4 w-4" /> Edit
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Profile + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Profile Card */}
          <Card className="lg:col-span-1">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full gold-gradient text-white text-2xl font-heading font-bold">
                  {getInitials(customer.name)}
                </div>
                <div>
                  <p className="font-semibold text-lg font-heading">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">Regular Customer</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {customer.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{customer.address}</span>
                  </div>
                )}
                {customer.notes && (
                  <div className="rounded-lg bg-secondary p-2 text-xs text-muted-foreground italic">
                    "{customer.notes}"
                  </div>
                )}
              </div>
              {customer.phone && (
                <a
                  href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" size="sm" className="w-full text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                    <Phone className="h-4 w-4" /> WhatsApp
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-start">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-gold-100 p-2">
                    <IndianRupee className="h-5 w-5 text-gold-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-gold-600">{formatCurrency(totalSpent)}</p>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold">{totalTxns}</p>
                    <p className="text-xs text-muted-foreground">Total Transactions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-100 p-2">
                    <Receipt className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold">
                      {totalTxns > 0 ? formatCurrency(totalSpent / totalTxns) : '₹0'}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg per Visit</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-violet-100 p-2">
                    <Clock className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {transactions[0] ? formatDate(transactions[0].transactionDate) : 'Never'}
                    </p>
                    <p className="text-xs text-muted-foreground">Last Visit</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Transaction History
              <Badge variant="secondary">{transactions.length} records</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">TXN No</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Payment</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((txn: any) => (
                    <tr key={txn.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono text-gold-600 font-medium text-xs">{txn.transactionNo}</td>
                      <td className="px-4 py-3">
                        <Badge variant={TYPE_VARIANTS[txn.type] ?? 'outline'} className="capitalize text-xs">
                          {TRANSACTION_TYPE_LABELS[txn.type as keyof typeof TRANSACTION_TYPE_LABELS] ?? txn.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(txn.transactionDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={STATUS_VARIANTS[txn.status] ?? 'secondary'} className="capitalize text-xs">
                          {txn.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={txn.paymentStatus === 'paid' ? 'success' : txn.paymentStatus === 'partial' ? 'warning' : 'secondary'}
                          className="text-xs capitalize"
                        >
                          {txn.paymentStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(txn.finalAmount)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/transactions/${txn.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        No transactions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <EditCustomerDialog open={showEdit} onClose={() => setShowEdit(false)} customer={customer} />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import api from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { TRANSACTION_TYPE_LABELS } from '@jever/shared';

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'info' | 'destructive' | 'secondary'> = {
  completed: 'success',
  in_progress: 'info',
  pending: 'warning',
  cancelled: 'destructive',
};

const TYPE_VARIANTS: Record<string, 'gold' | 'info' | 'warning' | 'secondary' | 'outline'> = {
  sale: 'gold',
  purchase: 'secondary',
  repair: 'info',
  exchange: 'warning',
  custom_order: 'outline',
};

type Transaction = any;

export function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [type, setType] = useState(() => searchParams.get('type') ?? 'all');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? 'all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const urlType = searchParams.get('type');
    const urlStatus = searchParams.get('status');
    if (urlType) setType(urlType);
    if (urlStatus) setStatus(urlStatus);
  }, [searchParams]);

  const { data = [], isLoading } = useQuery({
    queryKey: ['transactions', search, type, status, paymentStatus, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (type && type !== 'all') params.set('type', type);
      if (status && status !== 'all') params.set('status', status);
      if (paymentStatus && paymentStatus !== 'all') params.set('paymentStatus', paymentStatus);
      if (startDate) params.set('from', startDate);
      if (endDate) params.set('to', endDate);
      return api.get(`/transactions?${params}`).then((r) => r.data.data);
    },
  });

  const columns: ColumnDef<Transaction>[] = [
    {
      accessorKey: 'transactionNo',
      header: 'TXN No',
      cell: ({ row }) => <span className="font-mono font-medium text-gold-600">{row.getValue('transactionNo')}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const txn = row.original;
        return (
          <Badge variant={TYPE_VARIANTS[txn.type] ?? 'outline'} className="text-xs capitalize">
            {TRANSACTION_TYPE_LABELS[txn.type as keyof typeof TRANSACTION_TYPE_LABELS] ?? txn.type}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'customer.name',
      header: 'Customer',
      cell: ({ row }) => row.original.customer?.name ?? <span className="text-muted-foreground">Walk-in</span>,
    },
    {
      accessorKey: 'transactionDate',
      header: 'Date',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.getValue('transactionDate'))}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return (
          <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'} className="text-xs capitalize">
            {status.replace('_', ' ')}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'paymentStatus',
      header: 'Payment',
      cell: ({ row }) => {
        const paymentStatus = row.getValue('paymentStatus') as string;
        return (
          <Badge
            variant={paymentStatus === 'paid' ? 'success' : paymentStatus === 'partial' ? 'warning' : 'secondary'}
            className="text-xs capitalize"
          >
            {paymentStatus}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'finalAmount',
      header: 'Amount',
      cell: ({ row }) => <span className="font-semibold text-right block">{formatCurrency(row.getValue('finalAmount'))}</span>,
    },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => (
        <Link to={`/transactions/${row.original.id}`}>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            View
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Transactions"
        description={`${data.length} transactions`}
        action={
          <div className="flex gap-2">
            <Link to="/transactions/new/sale">
              <Button variant="gold" size="sm">
                <Plus className="h-4 w-4" /> New Sale
              </Button>
            </Link>
            <Link to="/transactions/new">
              <Button variant="outline" size="sm">
                Other
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by TXN no…"
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />

          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {['pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payment</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <DataTable columns={columns} data={data} isLoading={isLoading} />
      </div>
    </div>
  );
}

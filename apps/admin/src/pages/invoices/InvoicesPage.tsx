import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { FileText, Download, Eye, MessageCircle, Loader2, CheckCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import api from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

async function downloadInvoice(invoiceId: string, invoiceNo: string) {
  try {
    const res = await api.get(`/invoices/${invoiceId}/download`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNo}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast({ variant: 'destructive', title: 'Download failed' });
  }
}

type Invoice = any;

export function InvoicesPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [gstFilter, setGstFilter] = useState('all');

  const { data = [], isLoading } = useQuery({
    queryKey: ['invoices', startDate, endDate, gstFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (startDate) params.set('from', startDate);
      if (endDate) params.set('to', endDate);
      if (gstFilter !== 'all') params.set('gstEnabled', gstFilter === 'yes' ? 'true' : 'false');
      return api.get(`/invoices?${params}`).then((r) => r.data.data);
    },
  });

  async function handleWhatsApp(invoiceId: string) {
    try {
      const res = await api.post(`/invoices/${invoiceId}/whatsapp`);
      const { waUrl } = res.data.data;
      window.open(waUrl, '_blank');
      toast({ variant: 'success', title: 'WhatsApp opened', description: 'Send the pre-filled message to the customer.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed', description: err.response?.data?.error ?? 'Error' });
    }
  }

  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: 'invoiceNo',
      header: 'Invoice No',
      cell: ({ row }) => <span className="font-mono font-medium text-gold-600">{row.getValue('invoiceNo')}</span>,
    },
    {
      accessorKey: 'customer.name',
      header: 'Customer',
      cell: ({ row }) => row.original.customer?.name ?? <span className="text-muted-foreground">Walk-in</span>,
    },
    {
      accessorKey: 'issuedAt',
      header: 'Issued',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.getValue('issuedAt'))}</span>,
    },
    {
      accessorKey: 'gstEnabled',
      header: 'GST',
      cell: ({ row }) => (
        <Badge variant={row.getValue('gstEnabled') ? 'success' : 'secondary'}>
          {row.getValue('gstEnabled') ? 'GST' : 'Simple'}
        </Badge>
      ),
    },
    {
      accessorKey: 'whatsappSent',
      header: 'WhatsApp',
      cell: ({ row }) =>
        row.getValue('whatsappSent') ? (
          <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex items-center gap-2 justify-end">
            {inv.pdfUrl && (
              <>
                <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 text-gold-700 border-gold-300 hover:bg-gold-50"
                  onClick={() => downloadInvoice(inv.id, inv.invoiceNo)}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </>
            )}
            {inv.customer?.phone && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                onClick={() => handleWhatsApp(inv.id)}
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Invoices"
        description={`${data.length} invoices generated`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />

          <Select value={gstFilter} onValueChange={setGstFilter}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="All GST" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All GST Types</SelectItem>
              <SelectItem value="yes">With GST</SelectItem>
              <SelectItem value="no">Simple (No GST)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <DataTable columns={columns} data={data} isLoading={isLoading} />
      </div>
    </div>
  );
}

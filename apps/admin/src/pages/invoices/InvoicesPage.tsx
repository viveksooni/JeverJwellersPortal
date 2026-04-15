import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Eye, MessageCircle, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import api from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export function InvoicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices?limit=50').then((r) => r.data),
  });

  const invoices = data?.data ?? [];

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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Invoices"
        description={`${data?.total ?? 0} invoices generated`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Invoice No</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Issued</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">GST</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">WhatsApp</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono font-medium text-gold-600">{inv.invoiceNo}</td>
                  <td className="px-4 py-3">{inv.customer?.name ?? 'Walk-in'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(inv.issuedAt)}</td>
                  <td className="px-4 py-3 text-center">
                    {inv.gstEnabled ? (
                      <Badge variant="success">GST</Badge>
                    ) : (
                      <Badge variant="secondary">Simple</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {inv.whatsappSent ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {inv.pdfUrl && (
                        <>
                          {/* View — opens in browser tab */}
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                          </a>
                          {/* Download — backend sets Content-Disposition: attachment */}
                          <a href={`/api/invoices/${inv.id}/download`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-gold-700 border-gold-300 hover:bg-gold-50">
                              <Download className="h-3.5 w-3.5" /> Download
                            </Button>
                          </a>
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
                  </td>
                </tr>
              ))}
              {!isLoading && invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No invoices yet. Generate them from the Transactions page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Download, Eye, MessageCircle, Receipt,
  CheckCircle, Clock, XCircle, Wrench, Loader2, IndianRupee,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/lib/api';
import { formatCurrency, formatDateTime, formatWeight } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { TRANSACTION_TYPE_LABELS } from '@jever/shared';

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

const STATUS_ICON: Record<string, React.ElementType> = {
  completed: CheckCircle,
  in_progress: Clock,
  pending: Clock,
  cancelled: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-emerald-600',
  in_progress: 'text-blue-600',
  pending: 'text-amber-600',
  cancelled: 'text-red-500',
};

function GenerateInvoiceModal({
  open, onClose, transactionId, existingInvoice
}: {
  open: boolean; onClose: () => void; transactionId: string; existingInvoice: any;
}) {
  const qc = useQueryClient();
  const [gstEnabled, setGstEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await api.post('/invoices', { transactionId, gstEnabled });
      qc.invalidateQueries({ queryKey: ['transaction', transactionId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast({ variant: 'success', title: 'Invoice generated!' });
      onClose();
      if (res.data.data.pdfUrl) window.open(res.data.data.pdfUrl, '_blank');
    } catch {
      toast({ variant: 'destructive', title: 'Failed to generate invoice' });
    } finally {
      setLoading(false);
    }
  }

  if (existingInvoice) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invoice Already Generated</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Invoice <strong>{existingInvoice.invoiceNo}</strong> already exists for this transaction.
          </p>
          <DialogFooter className="gap-2">
            {existingInvoice.pdfUrl && (
              <a href={existingInvoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="gold"><Download className="h-4 w-4" /> Download PDF</Button>
              </a>
            )}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Generate Invoice</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Include GST (CGST + SGST)</Label>
            <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
          </div>
          {gstEnabled && (
            <p className="text-xs text-muted-foreground">
              GST rates configured in Settings will be applied. Ensure GSTIN is set in shop settings.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gold" onClick={handleGenerate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const backTo = (location.state as any)?.from ?? '/transactions';
  const qc = useQueryClient();
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');

  const { data: txn, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => api.get(`/transactions/${id}`).then((r) => r.data.data),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/transactions/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transaction', id] });
      toast({ variant: 'success', title: 'Status updated' });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (data: { paymentStatus: string; amountPaid: string }) =>
      api.put(`/transactions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transaction', id] });
      toast({ variant: 'success', title: 'Payment updated' });
    },
  });

  const repairMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/transactions/${id}/repair`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transaction', id] });
      toast({ variant: 'success', title: 'Repair status updated' });
    },
  });

  async function handleWhatsApp() {
    if (!txn?.invoice?.id) return;
    try {
      const res = await api.post(`/invoices/${txn.invoice.id}/whatsapp`);
      window.open(res.data.data.waUrl, '_blank');
      toast({ variant: 'success', title: 'WhatsApp opened' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: e.response?.data?.error ?? 'Error' });
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
      </div>
    );
  }

  if (!txn) return <div className="p-6 text-muted-foreground">Transaction not found.</div>;

  const StatusIcon = STATUS_ICON[txn.status] ?? Clock;
  const balance = parseFloat(txn.finalAmount) - parseFloat(txn.amountPaid);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={backTo}>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-semibold">{txn.transactionNo}</h1>
              <Badge variant="outline" className="capitalize text-xs">
                {TRANSACTION_TYPE_LABELS[txn.type as keyof typeof TRANSACTION_TYPE_LABELS] ?? txn.type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{formatDateTime(txn.transactionDate)}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Show Generate Invoice only when no invoice yet */}
          {!txn.invoice && (
            <Button variant="outline" size="sm" onClick={() => setShowInvoiceModal(true)}>
              <Receipt className="h-4 w-4" /> Generate Invoice
            </Button>
          )}
          {txn.invoice?.pdfUrl && (
            <>
              {/* View: open in new tab */}
              <a href={txn.invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm"><Eye className="h-4 w-4" /> View PDF</Button>
              </a>
              {/* Download: fetch with auth token */}
              <Button
                variant="outline"
                size="sm"
                className="text-gold-700 border-gold-300 hover:bg-gold-50"
                onClick={() => downloadInvoice(txn.invoice.id, txn.invoice.invoiceNo)}
              >
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </>
          )}
          {txn.customer?.phone && txn.invoice && (
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Items */}
          <div className="lg:col-span-2 space-y-5">

            {/* Line Items */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Items</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-semibold text-muted-foreground">#</th>
                      <th className="text-left py-2 font-semibold text-muted-foreground">Item</th>
                      <th className="text-right py-2 font-semibold text-muted-foreground">Qty</th>
                      <th className="text-right py-2 font-semibold text-muted-foreground">Weight</th>
                      <th className="text-right py-2 font-semibold text-muted-foreground">Rate/g</th>
                      <th className="text-right py-2 font-semibold text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(txn.items ?? []).map((item: any, i: number) => (
                      <tr key={item.id} className={item.isExchangeItem ? 'bg-emerald-50' : ''}>
                        <td className="py-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2">
                          <p className="font-medium">{item.productName}</p>
                          {item.purity && <p className="text-xs text-muted-foreground">{item.purity}</p>}
                          {item.isExchangeItem && <Badge variant="success" className="text-[10px]">Exchange In</Badge>}
                        </td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right font-mono text-xs">{formatWeight(item.weightG)}</td>
                        <td className="py-2 text-right text-xs text-muted-foreground">
                          {item.ratePerGram ? `₹${parseFloat(item.ratePerGram).toLocaleString('en-IN')}/g` : '-'}
                        </td>
                        <td className="py-2 text-right font-semibold">{formatCurrency(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border">
                      <td colSpan={5} className="pt-3 text-right text-muted-foreground">Subtotal</td>
                      <td className="pt-3 text-right font-semibold">{formatCurrency(txn.totalAmount)}</td>
                    </tr>
                    {parseFloat(txn.discountAmount) > 0 && (
                      <tr>
                        <td colSpan={5} className="text-right text-muted-foreground">Discount</td>
                        <td className="text-right text-red-600">- {formatCurrency(txn.discountAmount)}</td>
                      </tr>
                    )}
                    {parseFloat(txn.taxAmount) > 0 && (
                      <tr>
                        <td colSpan={5} className="text-right text-muted-foreground">GST</td>
                        <td className="text-right">{formatCurrency(txn.taxAmount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={5} className="pt-2 text-right font-heading text-base font-semibold text-gold-600">Total</td>
                      <td className="pt-2 text-right font-heading text-lg font-bold text-gold-600">{formatCurrency(txn.finalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            {/* Repair Order (if applicable) */}
            {txn.repairOrder && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-violet-500" /> Repair Order
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Item Description</p>
                      <p className="font-medium">{txn.repairOrder.itemDescription}</p>
                    </div>
                    {txn.repairOrder.repairType && (
                      <div>
                        <p className="text-xs text-muted-foreground">Repair Type</p>
                        <p className="font-medium">{txn.repairOrder.repairType}</p>
                      </div>
                    )}
                    {txn.repairOrder.deliveryDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Expected Delivery</p>
                        <p className="font-medium">{txn.repairOrder.deliveryDate}</p>
                      </div>
                    )}
                    {txn.repairOrder.repairCharge && (
                      <div>
                        <p className="text-xs text-muted-foreground">Repair Charge</p>
                        <p className="font-medium">{formatCurrency(txn.repairOrder.repairCharge)}</p>
                      </div>
                    )}
                  </div>
                  {txn.repairOrder.issueDescribed && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Issue</p>
                      <p className="text-sm bg-secondary rounded p-2">{txn.repairOrder.issueDescribed}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <Label className="text-xs">Repair Status</Label>
                    <Select
                      defaultValue={txn.repairOrder.status}
                      onValueChange={(v) => repairMutation.mutate(v)}
                    >
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['received', 'in_progress', 'ready', 'delivered'].map((s) => (
                          <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {txn.notes && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{txn.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Status + Customer + Payment */}
          <div className="space-y-4">
            {/* Status */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-5 w-5 ${STATUS_COLOR[txn.status]}`} />
                  <span className="font-medium capitalize">{txn.status.replace('_', ' ')}</span>
                </div>
                <Select defaultValue={txn.status} onValueChange={(v) => statusMutation.mutate(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Customer */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Customer</CardTitle></CardHeader>
              <CardContent>
                {txn.customer ? (
                  <div className="space-y-1">
                    <Link to={`/customers/${txn.customer.id}`} className="font-medium text-primary hover:underline">
                      {txn.customer.name}
                    </Link>
                    {txn.customer.phone && <p className="text-sm text-muted-foreground">{txn.customer.phone}</p>}
                    {txn.customer.email && <p className="text-sm text-muted-foreground">{txn.customer.email}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Walk-in Customer</p>
                )}
              </CardContent>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Payment</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{formatCurrency(txn.finalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="text-emerald-600 font-semibold">{formatCurrency(txn.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Balance Due</span>
                    <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(balance.toFixed(2))}
                    </span>
                  </div>
                </div>

                <Badge
                  variant={txn.paymentStatus === 'paid' ? 'success' : txn.paymentStatus === 'partial' ? 'warning' : 'secondary'}
                  className="capitalize"
                >
                  {txn.paymentStatus}
                </Badge>

                {txn.paymentStatus !== 'paid' && (
                  <div className="space-y-2 pt-1">
                    {/* Record partial payment */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="number"
                          className="pl-7 h-8 text-xs"
                          placeholder={`Max ₹${balance.toFixed(0)}`}
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          min="0"
                          max={balance.toFixed(2)}
                          step="0.01"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs shrink-0"
                        disabled={!partialAmount || parseFloat(partialAmount) <= 0 || paymentMutation.isPending}
                        onClick={() => {
                          const paid = Math.min(parseFloat(partialAmount), balance);
                          paymentMutation.mutate({
                            paymentStatus: 'partial',
                            amountPaid: (parseFloat(txn.amountPaid) + paid).toFixed(2),
                          });
                          setPartialAmount('');
                        }}
                      >
                        Record
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="gold"
                      className="w-full text-xs"
                      disabled={paymentMutation.isPending}
                      onClick={() => paymentMutation.mutate({ paymentStatus: 'paid', amountPaid: txn.finalAmount })}
                    >
                      Mark Fully Paid
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metal Rates at time of sale */}
            {(txn.goldRate || txn.silverRate) && (
              <Card>
                <CardContent className="pt-4 text-xs space-y-1">
                  <p className="text-muted-foreground uppercase tracking-wider font-semibold mb-2">Rates at Time of Sale</p>
                  {txn.goldRate && <div className="flex justify-between"><span>Gold 22K</span><span>₹{parseFloat(txn.goldRate).toLocaleString('en-IN')}/g</span></div>}
                  {txn.silverRate && <div className="flex justify-between"><span>Silver 999</span><span>₹{parseFloat(txn.silverRate).toLocaleString('en-IN')}/g</span></div>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <GenerateInvoiceModal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        transactionId={id!}
        existingInvoice={txn.invoice}
      />
    </div>
  );
}

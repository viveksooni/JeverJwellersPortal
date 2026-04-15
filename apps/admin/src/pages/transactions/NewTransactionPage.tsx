import { Link } from 'react-router-dom';
import { ShoppingCart, ShoppingBag, Wrench, ArrowLeftRight, Gem } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';

const TYPES = [
  {
    type: 'sale',
    label: 'Sale',
    icon: ShoppingCart,
    description: 'Sell jewelry to a customer. Updates inventory and generates invoice.',
    color: 'text-gold-500',
    bg: 'bg-gold-50 border-gold-200 hover:bg-gold-100',
  },
  {
    type: 'purchase',
    label: 'Purchase',
    icon: ShoppingBag,
    description: 'Buy jewelry or raw material. Adds stock to inventory.',
    color: 'text-blue-500',
    bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  {
    type: 'repair',
    label: 'Repair Order',
    icon: Wrench,
    description: 'Accept jewelry for repair. Track status from received to delivered.',
    color: 'text-violet-500',
    bg: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
  },
  {
    type: 'exchange',
    label: 'Exchange',
    icon: ArrowLeftRight,
    description: 'Customer exchanges old jewelry. Handles both incoming and outgoing items.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
  },
  {
    type: 'custom_order',
    label: 'Custom Order',
    icon: Gem,
    description: 'Create a bespoke jewelry order. Track advance payment and delivery.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
  },
];

export function NewTransactionPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="New Transaction" description="Choose the type of transaction to create" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto grid gap-4">
          {TYPES.map((t) => (
            <Link key={t.type} to={`/transactions/new/${t.type}`}>
              <Card className={`border-2 cursor-pointer transition-all ${t.bg}`}>
                <CardContent className="flex items-center gap-5 p-5">
                  <div className={`rounded-full p-3 bg-white shadow-sm ${t.color}`}>
                    <t.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-heading text-lg font-semibold text-foreground">{t.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

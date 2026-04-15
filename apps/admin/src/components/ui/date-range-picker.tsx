import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangePickerProps {
  startDate?: string;   // 'YYYY-MM-DD'
  endDate?: string;     // 'YYYY-MM-DD'
  onStartChange?: (date: string) => void;
  onEndChange?: (date: string) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  placeholder = 'Pick a date range',
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Convert stored string → Date | undefined
  const from = startDate ? new Date(startDate) : undefined;
  const to = endDate ? new Date(endDate) : undefined;

  function handleSelect(range: DateRange | undefined) {
    onStartChange?.(range?.from ? format(range.from, 'yyyy-MM-dd') : '');
    onEndChange?.(range?.to ? format(range.to, 'yyyy-MM-dd') : '');
    // Close only when both dates picked
    if (range?.from && range?.to) setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onStartChange?.('');
    onEndChange?.('');
  }

  const hasRange = from || to;

  const label = React.useMemo(() => {
    if (from && to) return `${format(from, 'dd MMM')} – ${format(to, 'dd MMM yyyy')}`;
    if (from) return `From ${format(from, 'dd MMM yyyy')}`;
    return placeholder;
  }, [from, to, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 gap-2 text-sm font-normal',
            !hasRange && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
          {hasRange && (
            <span
              role="button"
              onClick={handleClear}
              className="ml-1 rounded-sm opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={{ from, to }}
          onSelect={handleSelect}
          initialFocus
          numberOfMonths={2}
          disabled={(date) => date > new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}

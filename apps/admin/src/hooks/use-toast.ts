import * as React from 'react';
import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

type State = { toasts: ToasterToast[] };

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: { type: 'ADD' | 'REMOVE'; toast?: ToasterToast; toastId?: string }) {
  if (action.type === 'ADD') {
    memoryState = {
      toasts: [action.toast!, ...memoryState.toasts].slice(0, TOAST_LIMIT),
    };
  } else if (action.type === 'REMOVE') {
    memoryState = {
      toasts: action.toastId === undefined
        ? []
        : memoryState.toasts.filter((t) => t.id !== action.toastId),
    };
  }
  listeners.forEach((listener) => listener(memoryState));
}

function toast({ ...props }: Omit<ToasterToast, 'id'>) {
  const id = genId();
  dispatch({ type: 'ADD', toast: { ...props, id } });
  setTimeout(() => dispatch({ type: 'REMOVE', toastId: id }), TOAST_REMOVE_DELAY);
  return id;
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'REMOVE', toastId }),
  };
}

export { useToast, toast };

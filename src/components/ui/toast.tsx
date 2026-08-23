"use client";

import { useEffect } from "react";

interface ToastProps {
  title: string;
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ title, message, onDismiss, duration = 5200 }: ToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, onDismiss]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-950">{title}</p>
        <p className="mt-1 text-sm leading-5 text-zinc-600">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="-mr-1 -mt-1 shrink-0 rounded-md p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-3 focus-visible:outline-blue-600"
        aria-label="Закрыть уведомление"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
          <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

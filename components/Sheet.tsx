'use client';

import { useEffect, useRef } from 'react';

type SheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/** Bottom sheet used for the transcript and the settings panel. */
export default function Sheet({ open, title, onClose, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    // Esc closes the sheet before it reaches the stage, which would otherwise
    // close the whole stage from underneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // stopImmediatePropagation, not stopPropagation: the stage's own Esc
        // handler sits on window too, and would otherwise close the whole
        // stage out from under the sheet.
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Yopish"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-tub2 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="grid h-9 w-9 place-items-center rounded-full text-xira hover:bg-white/5 hover:text-qor"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

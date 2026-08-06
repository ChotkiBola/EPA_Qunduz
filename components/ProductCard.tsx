import type { Card } from '@/lib/types';

export default function ProductCard({ card }: { card: Card }) {
  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      /* min-w-0 matters: without it the grid item's automatic minimum size is
         the nowrap title's full width, so the card overflows on narrow screens. */
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/5 bg-tub2/80 p-3 text-left transition hover:border-suv/30 hover:bg-tub3"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-tub">
        {card.img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.img}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="mono-chip text-[10px] text-xira">EPA</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-qor group-hover:text-white">
          {card.n}
        </span>
        <span className="mono-chip mt-0.5 block text-xs text-yogoch-och">
          {card.s}
        </span>
      </span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0 text-xira transition group-hover:text-suv"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}

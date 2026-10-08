"use client";

import { useEffect, useState } from "react";

/** One site-wide key: dismissing on any page hides the hint everywhere. */
const STORAGE_KEY = "af:mobile-view-hint-dismissed";
/** Matches Tailwind's `md` breakpoint: the hint is for screens under 768px. */
const SMALL_SCREEN = "(max-width: 767.98px)";

/**
 * Small dismissible note for full detail chart pages on phones: the tiles are
 * built for mobile, the detail charts read best on desktop or tablet.
 *
 * Renders nothing on the server and on first client render (no hydration
 * flash), then checks the media query and localStorage. It eases open by
 * animating its row height so content below slides down gently rather than
 * jumping.
 */
export function MobileViewHint() {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Storage blocked (private mode etc.): still show, just won't persist.
    }
    if (dismissed) return;
    const mq = window.matchMedia(SMALL_SCREEN);
    const sync = () => setShow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!show) {
      setOpen(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setOpen(true));
    return () => window.cancelAnimationFrame(id);
  }, [show]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    window.setTimeout(() => setShow(false), 220);
  };

  if (!show) return null;

  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-200 ease-out md:hidden"
      style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      data-mobile-view-hint
    >
      <div className="overflow-hidden">
        <div
          role="note"
          className="mb-4 flex items-start gap-2 rounded-lg border border-border/80 bg-card/60 px-3 py-2 text-xs leading-snug text-muted"
        >
          <p className="flex-1">
            Best viewed on desktop or tablet. Rotate your phone or use the tiles
            for a quick look.
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss this note"
            className="-my-1 -mr-1 shrink-0 rounded px-1.5 py-0.5 text-base leading-none text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

/** One-line muted caption for the tile hubs, mobile only (pure CSS, no JS). */
export function MobileTilesCaption() {
  return (
    <p className="mt-2 text-xs text-muted/80 md:hidden">
      Tap a tile for the full chart, best on a bigger screen.
    </p>
  );
}

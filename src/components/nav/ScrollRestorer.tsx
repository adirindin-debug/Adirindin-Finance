"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const KEY = (k: string) => `sr:${k}`;
const here = () => location.pathname + location.search;

/**
 * Restores the scroll position when the user comes back to a page (browser back/forward or an
 * in-page "Back to …" link that calls router.back()). Positions are saved per URL in sessionStorage;
 * on return we keep re-applying the saved Y for a moment while charts and tiles load and the page
 * grows, and stop as soon as the user scrolls themselves.
 */
export function ScrollRestorer() {
  const pathname = usePathname();
  const pending = useRef<number | null>(null);
  const last = useRef<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const save = () => {
      if (pending.current != null) return; // don't overwrite while restoring
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => sessionStorage.setItem(KEY(here()), String(Math.round(scrollY))));
    };
    const onPop = () => {
      const v = Number(sessionStorage.getItem(KEY(here())));
      pending.current = Number.isFinite(v) && v > 0 ? v : null;
    };
    addEventListener("scroll", save, { passive: true });
    addEventListener("popstate", onPop);
    return () => {
      removeEventListener("scroll", save);
      removeEventListener("popstate", onPop);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (last.current) sessionStorage.setItem("sr:prev", last.current);
    last.current = here();
    const target = pending.current;
    if (target == null) return;
    let stop = false;
    let stable = 0;
    const started = performance.now();
    const cancel = () => (stop = true);
    const opts = { passive: true, once: true } as const;
    addEventListener("wheel", cancel, opts);
    addEventListener("touchstart", cancel, opts);
    addEventListener("keydown", cancel, opts);
    const tick = () => {
      if (stop || performance.now() - started > 4000) return done();
      const max = document.documentElement.scrollHeight - innerHeight;
      if (max >= target - 2) {
        if (Math.abs(scrollY - target) > 2) {
          scrollTo(0, target);
          stable = 0;
        } else if (++stable > 30) return done();
      } else {
        scrollTo(0, max);
      }
      requestAnimationFrame(tick);
    };
    const done = () => {
      pending.current = null;
      removeEventListener("wheel", cancel);
      removeEventListener("touchstart", cancel);
      removeEventListener("keydown", cancel);
    };
    requestAnimationFrame(tick);
    return () => {
      stop = true;
    };
  }, [pathname]);

  return null;
}

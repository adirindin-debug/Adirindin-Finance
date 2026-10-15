"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * "← Back to …" link. If the user just came from that page within the site, it goes back in
 * history (so their scroll position is restored); otherwise it navigates to href as normal.
 */
export function BackLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const prev = sessionStorage.getItem("sr:prev");
        if (prev && prev.split("?")[0] === href && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}

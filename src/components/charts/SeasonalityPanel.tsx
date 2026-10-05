"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ASSET_DEF,
  ASSET_LABEL,
  MARKET_ASSETS,
  SEASON_FOOTER,
  buildGrid,
  cellKey,
  coverageLabel,
  fmtClose,
  fmtDate,
  fmtRet,
  tileBg,
  type SeasonAsset,
  type SeasonCell,
  type SeasonMarket,
  type SeasonPayload,
  type SeasonPeriod,
} from "@/lib/seasonality";

const PERIODS: Array<{ key: SeasonPeriod; label: string }> = [
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
];

const toggleBtn = "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors";
const toggleOn = "bg-accent text-white shadow-sm";
const toggleOff = "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

type Hover = { cell: SeasonCell; x: number; y: number; below: boolean };

export function SeasonalityPanel({ market }: { market: SeasonMarket }) {
  // Asset toggle comes straight from the registry: add an asset there and it appears here.
  const assets = MARKET_ASSETS(market);
  const [data, setData] = useState<SeasonPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<SeasonAsset>(assets[0]!.key);
  const [period, setPeriod] = useState<SeasonPeriod>("monthly");
  const [assetOpen, setAssetOpen] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const assetMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/seasonality?market=${market}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: SeasonPayload) => {
        if (cancelled) return;
        if (!j?.ok) throw new Error(j?.error ?? "No data");
        setData(j);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [market]);

  const series = data?.assets[asset];
  const grid = useMemo(() => (series ? buildGrid(series, period) : null), [series, period]);

  const showTip = useCallback((cell: SeasonCell, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const below = r.top < 150;
    setHover({ cell, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
  }, []);

  useEffect(() => {
    if (!hover) return;
    const clear = () => setHover(null);
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) clear();
    };
    window.addEventListener("scroll", clear, { passive: true, capture: true });
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("scroll", clear, { capture: true });
      window.removeEventListener("pointerdown", onDown);
    };
  }, [hover]);

  useEffect(() => {
    if (!assetOpen) return;
    const onDown = (e: PointerEvent) => {
      if (assetMenuRef.current && !assetMenuRef.current.contains(e.target as Node)) setAssetOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAssetOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [assetOpen]);

  const curStat = grid?.current ? grid.stats[grid.current.col] : undefined;
  const curCell = grid?.current ? grid.cells.get(cellKey(grid.current.year, grid.current.col)) : undefined;
  const curName = grid?.current
    ? period === "monthly"
      ? new Date(Date.UTC(2000, grid.current.col, 1)).toLocaleString("en-AU", { month: "long", timeZone: "UTC" })
      : `Q${grid.current.col + 1}`
    : "";
  const unit = period === "monthly" ? "month" : "quarter";
  const def = ASSET_DEF[asset];
  const tz = def.clock === "utc" ? "UTC days" : "New York trading days";

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
          {period === "monthly" ? "Monthly" : "Quarterly"} returns · {ASSET_LABEL[asset]}
        </h2>
        <div ref={assetMenuRef} className="relative">
          <button
            type="button"
            className={`${toggleBtn} inline-flex items-center gap-1.5 rounded-lg border border-border/90 ${assetOpen ? toggleOn : "bg-[#11161d] text-foreground/85 hover:bg-white/5 hover:text-foreground"}`}
            aria-haspopup="listbox"
            aria-expanded={assetOpen}
            aria-label="Asset"
            onClick={() => setAssetOpen((o) => !o)}
          >
            {ASSET_LABEL[asset]}
            <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 opacity-90 transition-transform ${assetOpen ? "rotate-180" : ""}`}>
              <path fill="currentColor" d="M2.2 4.2a.75.75 0 0 1 1.06 0L6 6.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L2.2 5.26a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
          {assetOpen ? (
            <ul
              role="listbox"
              aria-label="Assets"
              className="absolute left-0 z-30 mt-1 min-w-[12rem] overflow-hidden rounded-lg border border-border/90 bg-[#11161d] py-1 shadow-lg"
            >
              {assets.map((a) => (
                <li key={a.key} role="option" aria-selected={asset === a.key}>
                  <button
                    type="button"
                    className={`flex w-full items-center px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${
                      asset === a.key ? "bg-accent text-white" : "text-foreground/80 hover:bg-white/5 hover:text-foreground"
                    }`}
                    onClick={() => {
                      setAsset(a.key);
                      setAssetOpen(false);
                      setHover(null);
                    }}
                  >
                    {a.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="inline-flex gap-1 rounded-lg border border-border/90 bg-[#11161d] p-1" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`${toggleBtn} ${period === p.key ? toggleOn : toggleOff}`}
              aria-pressed={period === p.key}
              onClick={() => {
                setPeriod(p.key);
                setHover(null);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {grid && curStat ? (
        <p className="mt-3 text-sm text-foreground/85">
          {curName} {grid.current!.year} so far:{" "}
          <span
            className="font-mono font-semibold"
            style={{ color: curCell?.ret == null ? undefined : curCell.ret >= 0 ? "#3dcc9a" : "#ef6b6b" }}
          >
            {fmtRet(curCell?.ret)}
          </span>{" "}
          <span className="text-muted">(in progress{curCell ? `, to ${fmtDate(curCell.endDate)}` : ""})</span>. In past
          years, {curName} closed green in{" "}
          <span className="font-mono font-semibold text-foreground">
            {curStat.green} of {curStat.n}
          </span>{" "}
          ({curStat.pctGreen == null ? "—" : `${Math.round(curStat.pctGreen)}%`}), average{" "}
          <span className="font-mono">{fmtRet(curStat.avg)}</span>. History, not a prediction.
        </p>
      ) : null}

      <div ref={wrapRef} className="relative mt-4">
        {!grid ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-border/60 text-sm text-muted">
            {error ? `Data unavailable (${error})` : "Loading…"}
          </div>
        ) : (
          <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-color:#2a3340_transparent]">
            <table className="w-full min-w-[720px] border-separate border-spacing-[3px] text-center font-mono text-[11px] sm:text-xs">
              <caption className="sr-only">
                {ASSET_LABEL[asset]} {period} returns by year. Rows are years (newest first).
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-20 w-14 bg-card px-1 py-1 text-left font-sans text-[10px] font-semibold uppercase tracking-wide text-muted"
                  >
                    Year
                  </th>
                  {grid.cols.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={`px-1 py-1 font-sans text-[10px] font-semibold uppercase tracking-wide ${
                        grid.current?.col === i ? "text-foreground" : "text-muted"
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-card px-1 text-left font-sans text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted"
                  >
                    Green
                    <br />
                    years
                  </th>
                  {grid.stats.map((s) => (
                    <td
                      key={s.col}
                      className="rounded-[5px] border border-border/70 bg-[#0d1218] px-1 py-1.5"
                      style={
                        grid.current?.col === s.col
                          ? { borderColor: "rgba(232,238,247,0.55)" }
                          : undefined
                      }
                    >
                      <span
                        className="block text-xs font-bold sm:text-[13px]"
                        style={{
                          color: s.pctGreen == null ? undefined : s.pctGreen >= 50 ? "#3dcc9a" : "#ef6b6b",
                        }}
                      >
                        {s.pctGreen == null ? "—" : `${Math.round(s.pctGreen)}%`}
                      </span>
                      <span className="block text-[10px] font-normal text-muted">
                        {s.green} of {s.n} green
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-card px-1 text-left font-sans text-[10px] font-semibold uppercase tracking-wide text-muted"
                  >
                    Average
                  </th>
                  {grid.stats.map((s) => (
                    <td
                      key={s.col}
                      className="rounded-[5px] bg-[#0d1218] px-1 py-1 font-semibold"
                      style={{ color: s.avg == null ? undefined : s.avg >= 0 ? "#3dcc9a" : "#ef6b6b" }}
                    >
                      {fmtRet(s.avg)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-card px-1 text-left font-sans text-[10px] font-semibold uppercase tracking-wide text-muted"
                  >
                    Median
                  </th>
                  {grid.stats.map((s) => (
                    <td key={s.col} className="rounded-[5px] bg-[#0d1218] px-1 py-1 text-foreground/75">
                      {fmtRet(s.median)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={grid.cols.length + 1} className="pb-1 pt-2">
                    <div className="sticky left-0 w-fit max-w-[calc(100vw-4.5rem)] text-left font-sans text-[11px] text-muted sm:max-w-none">
                      <span className="font-semibold uppercase tracking-wide text-foreground/80">History, not a prediction</span>{" "}
                      · odds and averages from completed years only ({coverageLabel(grid)}); the {unit} in progress is excluded. Yearly tiles below.
                    </div>
                  </td>
                </tr>
              </tbody>
              <tbody>
                {grid.years.map((y) => (
                  <tr key={y}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card px-1 text-left font-mono text-[11px] font-semibold text-foreground/85 sm:text-xs"
                    >
                      {y}
                    </th>
                    {grid.cols.map((_, col) => {
                      const cell = grid.cells.get(cellKey(y, col));
                      const isCur = grid.current?.year === y && grid.current.col === col;
                      if (!cell || (cell.ret == null && !cell.inProgress)) {
                        return (
                          <td
                            key={col}
                            className="h-8 rounded-[5px] text-foreground/20"
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              outline: isCur ? "1.5px dashed rgba(232,238,247,0.55)" : undefined,
                              outlineOffset: isCur ? "-1.5px" : undefined,
                            }}
                            title={isCur ? "In progress · no close yet" : undefined}
                          >
                            {isCur ? "·" : ""}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={col}
                          tabIndex={0}
                          className="relative h-8 min-w-[52px] cursor-default rounded-[5px] px-1 font-semibold text-[#f3f6fb] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          style={{
                            background: tileBg(asset, period, cell.ret),
                            outline: cell.inProgress ? "1.5px dashed rgba(232,238,247,0.9)" : undefined,
                            outlineOffset: cell.inProgress ? "-1.5px" : undefined,
                          }}
                          aria-label={`${cell.label}: ${fmtRet(cell.ret)}${cell.inProgress ? " (in progress)" : ""}`}
                          onMouseEnter={(e) => showTip(cell, e.currentTarget)}
                          onMouseLeave={() => setHover(null)}
                          onFocus={(e) => showTip(cell, e.currentTarget)}
                          onBlur={() => setHover(null)}
                          onClick={(e) => showTip(cell, e.currentTarget)}
                        >
                          {fmtRet(cell.ret)}
                          {cell.inProgress ? (
                            <span
                              aria-hidden
                              className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-[#e8eef7]"
                            />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hover ? (
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 w-max max-w-[min(300px,calc(100vw-16px))] rounded-md border border-border/80 bg-black/95 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-[#e8eef7] shadow-lg"
            style={{
              left: `clamp(8px, ${hover.x}px - 150px, calc(100vw - min(300px, 100vw - 16px) - 8px))`,
              top: hover.y,
              transform: hover.below ? undefined : "translateY(-100%)",
            }}
          >
            <div className="font-sans text-xs font-semibold text-foreground">
              {hover.cell.label}
              {hover.cell.inProgress ? <span className="ml-1.5 font-normal text-muted">· in progress</span> : null}
            </div>
            <div className="mt-0.5">
              {hover.cell.prevDate ? `${fmtDate(hover.cell.prevDate)} close ${fmtClose(asset, hover.cell.prevClose)}` : "No prior close"}
            </div>
            <div>
              → {fmtDate(hover.cell.endDate)} {hover.cell.inProgress ? "latest close" : "close"} {fmtClose(asset, hover.cell.close)}
            </div>
            <div
              className="mt-0.5 font-semibold"
              style={{ color: hover.cell.ret == null ? undefined : hover.cell.ret >= 0 ? "#3dcc9a" : "#ef6b6b" }}
            >
              {fmtRet(hover.cell.ret, 2)}
            </div>
            {hover.cell.avgSource ? (
              <div className="mt-0.5 font-sans text-[10px] text-muted">Includes a blockchain.com daily average (pre-Sep 2014)</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-[3px]" style={{ background: "rgba(61,204,154,0.7)" }} aria-hidden />
          Closed higher
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-[3px]" style={{ background: "rgba(239,107,107,0.7)" }} aria-hidden />
          Closed lower
        </span>
        <span>Stronger shade = bigger move</span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="relative h-3 w-4 rounded-[3px]"
            style={{ outline: "1.5px dashed rgba(232,238,247,0.9)", outlineOffset: "-1.5px" }}
            aria-hidden
          />
          In progress (latest close so far)
        </span>
        <span className="sm:hidden">Swipe sideways for all columns · tap a tile for dates and closes</span>
      </div>

      <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted">
        <p>
          Each tile is the {unit}&apos;s % change: close on its last trading day vs the close on the previous {unit}&apos;s last
          trading day ({tz}). Odds = share of completed years in which that {unit} closed higher; averages and medians are
          simple, unweighted. Hover or tap a tile for the exact dates and closes.
        </p>
        <p>{def.source}</p>
        <p>
          Data to {series ? fmtDate(series.lastDate) : "—"}
          {series?.snapshot && data?.snapshotAsOf ? ` · dated snapshot (${fmtDate(data.snapshotAsOf)})` : ""}. Updates
          automatically (cached for up to an hour).
        </p>
      </div>
      <p className="mt-4 border-t border-border pt-3 text-xs text-foreground/80">{SEASON_FOOTER}</p>
    </section>
  );
}

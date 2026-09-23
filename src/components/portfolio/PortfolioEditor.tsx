"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  AssetKind,
  CostCurrency,
  PortfolioConfig,
  PortfolioHolding,
} from "@/lib/portfolioTypes";
import { createHoldingId, collectableTickerFromName } from "@/lib/portfolioStorage";

type TickerSuggestion = {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
};

type Props = {
  portfolio: PortfolioConfig;
  editing: PortfolioHolding | null;
  open: boolean;
  onClose: () => void;
  onSaveHolding: (holding: PortfolioHolding) => void;
  onDeleteHolding: (id: string) => void;
  onUpdateMeta: (patch: Partial<Pick<PortfolioConfig, "name" | "availableCashAud">>) => void;
  onClearAll: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

export function PortfolioEditor({
  portfolio,
  editing,
  open,
  onClose,
  onSaveHolding,
  onDeleteHolding,
  onUpdateMeta,
  onClearAll,
  onExport,
  onImport,
}: Props) {
  const [kind, setKind] = useState<AssetKind>("security");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [costCurrency, setCostCurrency] = useState<CostCurrency>("AUD");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [estimatedValueCurrency, setEstimatedValueCurrency] = useState<CostCurrency>("AUD");
  const [notes, setNotes] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [portfolioName, setPortfolioName] = useState(portfolio.name);
  const [cash, setCash] = useState(
    portfolio.availableCashAud == null ? "" : String(portfolio.availableCashAud),
  );
  const [error, setError] = useState<string | null>(null);
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(-1);
  const fileRef = useRef<HTMLInputElement>(null);
  const suggestAbort = useRef<AbortController | null>(null);
  const skipSearchFor = useRef<string | null>(null);
  const suggestListId = useId();

  useEffect(() => {
    if (!open) return;
    setPortfolioName(portfolio.name);
    setCash(portfolio.availableCashAud == null ? "" : String(portfolio.availableCashAud));
    if (editing) {
      setKind(editing.kind ?? "security");
      setTicker(editing.ticker);
      setName(editing.name ?? "");
      setQuantity(String(editing.quantity));
      setCostBasis(editing.costBasis > 0 ? String(editing.costBasis) : "");
      setCostCurrency(editing.costCurrency ?? "AUD");
      setEstimatedValue(
        editing.estimatedValue != null ? String(editing.estimatedValue) : "",
      );
      setEstimatedValueCurrency(editing.estimatedValueCurrency ?? "AUD");
      setNotes(editing.notes ?? "");
      setAcquiredAt(editing.acquiredAt?.slice(0, 10) ?? "");
    } else {
      setKind("security");
      setTicker("");
      setName("");
      setQuantity("");
      setCostBasis("");
      setCostCurrency("AUD");
      setEstimatedValue("");
      setEstimatedValueCurrency("AUD");
      setNotes("");
      setAcquiredAt("");
    }
    setError(null);
    setAddedFlash(null);
    setSuggestions([]);
    setSuggestOpen(false);
    setSuggestLoading(false);
    setActiveSuggest(-1);
  }, [open, editing, portfolio.name, portfolio.availableCashAud]);

  // Debounced Yahoo ticker / name search for securities
  useEffect(() => {
    if (!open || kind !== "security" || editing) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    const q = ticker.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      return;
    }
    if (
      skipSearchFor.current &&
      q.toUpperCase() === skipSearchFor.current.toUpperCase()
    ) {
      skipSearchFor.current = null;
      setSuggestions([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      return;
    }
    const handle = window.setTimeout(async () => {
      suggestAbort.current?.abort();
      const ac = new AbortController();
      suggestAbort.current = ac;
      setSuggestLoading(true);
      try {
        const res = await fetch(
          `/api/ticker-search?q=${encodeURIComponent(q)}`,
          { signal: ac.signal },
        );
        const data = (await res.json()) as {
          suggestions?: TickerSuggestion[];
        };
        if (ac.signal.aborted) return;
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setSuggestOpen(true);
        setActiveSuggest(list.length ? 0 : -1);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setSuggestions([]);
        setSuggestOpen(false);
      } finally {
        if (!ac.signal.aborted) setSuggestLoading(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(handle);
      suggestAbort.current?.abort();
    };
  }, [ticker, open, kind, editing]);

  const applySuggestion = useCallback((s: TickerSuggestion) => {
    skipSearchFor.current = s.symbol;
    setTicker(s.symbol);
    if (s.name) setName(s.name);
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveSuggest(-1);
  }, []);

  if (!open) return null;

  function submitHolding(e: React.FormEvent) {
    e.preventDefault();

    if (kind === "collectable") {
      const label = name.trim();
      if (!label) {
        setError("Collectable name / label is required");
        return;
      }
      const est = Number(estimatedValue);
      if (!Number.isFinite(est) || est < 0) {
        setError("Estimated value must be ≥ 0");
        return;
      }
      const cost = costBasis.trim() === "" ? 0 : Number(costBasis);
      if (!Number.isFinite(cost) || cost < 0) {
        setError("Optional cost must be ≥ 0");
        return;
      }
      onSaveHolding({
        id: editing?.id ?? createHoldingId(),
        kind: "collectable",
        ticker: collectableTickerFromName(label),
        name: label,
        quantity: 1,
        costBasis: cost,
        costCurrency,
        estimatedValue: est,
        estimatedValueCurrency,
        notes: notes.trim() || undefined,
        color: editing?.color,
        acquiredAt: acquiredAt.trim() || undefined,
      });
      setError(null);
      if (!editing) {
        setAddedFlash(`Added ${label}`);
        window.setTimeout(() => setAddedFlash(null), 2400);
        setName("");
        setEstimatedValue("");
        setCostBasis("");
        setNotes("");
        setAcquiredAt("");
      } else {
        onClose();
      }
      return;
    }

    // Security
    const t = ticker.trim().toUpperCase();
    const qty = Number(quantity);
    const cost = Number(costBasis);
    if (!t) {
      setError("Ticker is required");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be a positive number");
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setError(`Avg cost (${costCurrency}) must be ≥ 0`);
      return;
    }
    onSaveHolding({
      id: editing?.id ?? createHoldingId(),
      kind: "security",
      ticker: t,
      name: name.trim() || undefined,
      quantity: qty,
      costBasis: cost,
      costCurrency,
      color: editing?.color,
      acquiredAt: acquiredAt.trim() || undefined,
    });
    setError(null);
    if (!editing) {
      setAddedFlash(`Added ${t}`);
      window.setTimeout(() => setAddedFlash(null), 2400);
      setTicker("");
      setName("");
      setQuantity("");
      setCostBasis("");
      setAcquiredAt("");
      setSuggestions([]);
      setSuggestOpen(false);
    } else {
      onClose();
    }
  }

  function saveMeta() {
    const cashNum = cash.trim() === "" ? null : Number(cash);
    if (cashNum != null && !Number.isFinite(cashNum)) {
      setError("Cash must be a number or blank");
      return;
    }
    if (cashNum != null && cashNum < 0) {
      setError("Cash cannot be negative");
      return;
    }
    onUpdateMeta({
      name: portfolioName.trim() || "Long term strategy",
      availableCashAud: cashNum,
    });
    setError(null);
  }

  function handleClear() {
    if (typeof window !== "undefined" && window.confirm("Clear all holdings and reset portfolio?")) {
      onClearAll();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit portfolio"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">
            {editing ? "Edit holding" : "Manage portfolio"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            Close
          </button>
        </div>

        {!editing && (
          <div className="mb-5 space-y-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500/90">
              Available cash (AUD)
            </p>
            <label className="block text-xs text-zinc-500">
              Portfolio name
              <input
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Cash balance included in total A$ &amp; allocation
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  A$
                </span>
                <input
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-700 bg-black py-2 pl-10 pr-3 text-sm text-white outline-none focus:border-emerald-700"
                />
              </div>
            </label>
            <button
              type="button"
              onClick={saveMeta}
              className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Save name / cash
            </button>
          </div>
        )}

        <form onSubmit={submitHolding} className="space-y-3">
          {!editing && (
            <div className="flex gap-1 rounded-lg bg-zinc-900 p-0.5">
              {(
                [
                  ["security", "Security"],
                  ["collectable", "Collectable"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    kind === k
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {kind === "security" ? (
            <>
              <div className="relative block text-xs text-zinc-500">
                <label htmlFor="holding-ticker" className="block">
                  Ticker
                </label>
                <input
                  id="holding-ticker"
                  value={ticker}
                  onChange={(e) => {
                    setTicker(e.target.value);
                    setSuggestOpen(true);
                  }}
                  onFocus={() => {
                    if (suggestions.length) setSuggestOpen(true);
                  }}
                  onBlur={() => {
                    // Delay so click/keyboard select can fire
                    window.setTimeout(() => setSuggestOpen(false), 150);
                  }}
                  onKeyDown={(e) => {
                    if (!suggestOpen || suggestions.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveSuggest((i) =>
                        i < suggestions.length - 1 ? i + 1 : 0,
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveSuggest((i) =>
                        i <= 0 ? suggestions.length - 1 : i - 1,
                      );
                    } else if (e.key === "Enter" && activeSuggest >= 0) {
                      e.preventDefault();
                      const s = suggestions[activeSuggest];
                      if (s) applySuggestion(s);
                    } else if (e.key === "Escape") {
                      setSuggestOpen(false);
                    }
                  }}
                  placeholder="CBA.AX / MSTR / BTC-USD"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={suggestOpen && suggestions.length > 0}
                  aria-controls={suggestListId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    activeSuggest >= 0
                      ? `${suggestListId}-opt-${activeSuggest}`
                      : undefined
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm uppercase text-white outline-none focus:border-zinc-600"
                  required
                />
                {suggestLoading && (
                  <p className="mt-1 text-[10px] text-zinc-600">Searching…</p>
                )}
                {suggestOpen && suggestions.length > 0 && (
                  <ul
                    id={suggestListId}
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-xl"
                  >
                    {suggestions.map((s, i) => (
                      <li key={s.symbol} role="presentation">
                        <button
                          type="button"
                          id={`${suggestListId}-opt-${i}`}
                          role="option"
                          aria-selected={i === activeSuggest}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySuggestion(s)}
                          onMouseEnter={() => setActiveSuggest(i)}
                          className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${
                            i === activeSuggest
                              ? "bg-zinc-800 text-white"
                              : "text-zinc-300 hover:bg-zinc-900"
                          }`}
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="font-mono text-sm font-semibold uppercase">
                              {s.symbol}
                            </span>
                            {s.exchange && (
                              <span className="truncate text-[10px] text-zinc-500">
                                {s.exchange}
                              </span>
                            )}
                          </span>
                          <span className="truncate text-[11px] text-zinc-500">
                            {s.name}
                            {s.type ? ` · ${s.type}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {suggestOpen &&
                  !suggestLoading &&
                  ticker.trim().length > 0 &&
                  suggestions.length === 0 && (
                    <p className="mt-1 text-[10px] text-zinc-600">
                      No matches — try another ticker or company name
                    </p>
                  )}
              </div>
              <label className="block text-xs text-zinc-500">
                Name (optional)
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Commonwealth Bank"
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-zinc-500">
                  Quantity
                  <input
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    inputMode="decimal"
                    placeholder="10"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
                    required
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Avg cost
                  <input
                    value={costBasis}
                    onChange={(e) => setCostBasis(e.target.value)}
                    inputMode="decimal"
                    placeholder="120.50"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
                    required
                  />
                </label>
              </div>
              <fieldset className="block text-xs text-zinc-500">
                <legend className="mb-1">Cost currency</legend>
                <div className="flex gap-1 rounded-lg bg-zinc-900 p-0.5">
                  {(["AUD", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCostCurrency(c)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        costCurrency === c
                          ? "bg-zinc-700 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-zinc-600">
                  Stored in {costCurrency}; totals shown in A$ via live AUDUSD.
                </p>
              </fieldset>
            </>
          ) : (
            <>
              <label className="block text-xs text-zinc-500">
                Name / label
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rolex Submariner / Wine cellar"
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-zinc-500">
                  Estimated value
                  <input
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    inputMode="decimal"
                    placeholder="15000"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
                    required
                  />
                </label>
                <fieldset className="block text-xs text-zinc-500">
                  <legend className="mb-1">Value currency</legend>
                  <div className="mt-1 flex gap-1 rounded-lg bg-zinc-900 p-0.5">
                    {(["AUD", "USD"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEstimatedValueCurrency(c)}
                        className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                          estimatedValueCurrency === c
                            ? "bg-zinc-700 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-zinc-500">
                  Cost (optional)
                  <input
                    value={costBasis}
                    onChange={(e) => setCostBasis(e.target.value)}
                    inputMode="decimal"
                    placeholder="for gains"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
                  />
                </label>
                <fieldset className="block text-xs text-zinc-500">
                  <legend className="mb-1">Cost currency</legend>
                  <div className="mt-1 flex gap-1 rounded-lg bg-zinc-900 p-0.5">
                    {(["AUD", "USD"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCostCurrency(c)}
                        className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                          costCurrency === c
                            ? "bg-zinc-700 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              <label className="block text-xs text-zinc-500">
                Notes (optional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Provenance, condition…"
                  className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
                />
              </label>
            </>
          )}

          <label className="block text-xs text-zinc-500">
            Acquired date (optional — performance history)
            <input
              type="date"
              value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
            />
          </label>

          {error && <p className="text-xs text-rose-400">{error}</p>}
          {addedFlash && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-400"
            >
              <span aria-hidden className="text-sm">✓</span>
              {addedFlash}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            {editing
              ? "Update holding"
              : kind === "collectable"
                ? "Add collectable"
                : "Add security"}
          </button>

          {editing && (
            <button
              type="button"
              onClick={() => {
                const label = editing.kind === "collectable" ? editing.name ?? editing.ticker : editing.ticker;
                if (window.confirm(`Delete ${label}?`)) {
                  onDeleteHolding(editing.id);
                  onClose();
                }
              }}
              className="w-full rounded-lg border border-rose-900/60 px-3 py-2 text-sm text-rose-400 hover:bg-rose-950/40"
            >
              Delete holding
            </button>
          )}
        </form>

        {!editing && (
          <div className="mt-5 space-y-2 border-t border-zinc-900 pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onExport}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-rose-400 hover:bg-zinc-900"
              >
                Clear all
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Data stays in this browser (localStorage). Securities: cost in AUD or USD (converted
              may be delayed). Collectables: estimated value, no Yahoo ticker. Portfolio displayed in A$.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

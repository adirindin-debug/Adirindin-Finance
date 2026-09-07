"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AssetKind,
  CostCurrency,
  PortfolioConfig,
  PortfolioHolding,
} from "@/lib/portfolioTypes";
import { createHoldingId, collectableTickerFromName } from "@/lib/portfolioStorage";

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
  const fileRef = useRef<HTMLInputElement>(null);

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
  }, [open, editing, portfolio.name, portfolio.availableCashAud]);

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
      setTicker("");
      setName("");
      setQuantity("");
      setCostBasis("");
      setAcquiredAt("");
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
              <label className="block text-xs text-zinc-500">
                Ticker
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="CBA.AX / MSTR / BTC-USD"
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm uppercase text-white outline-none focus:border-zinc-600"
                  required
                />
              </label>
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
              live). Collectables: estimated value, no Yahoo ticker. Portfolio displayed in A$.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

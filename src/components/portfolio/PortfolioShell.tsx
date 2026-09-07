"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PortfolioConfig,
  PortfolioHolding,
  QuoteResult,
} from "@/lib/portfolioTypes";
import { DEFAULT_PORTFOLIO, HOLDING_COLORS } from "@/lib/portfolioTypes";
import {
  clearPortfolioStorage,
  exportPortfolioJson,
  importPortfolioJson,
  loadPortfolioFromSources,
  savePortfolioToStorage,
} from "@/lib/portfolioStorage";
import { computeLiveHoldings } from "@/lib/portfolioCompute";
import { PortfolioSummary } from "./PortfolioSummary";
import { PerformanceChart } from "./PerformanceChart";
import { AllocationDonutEmpty } from "./AllocationDonutEmpty";
import { HoldingsListEmpty } from "./HoldingsListEmpty";
import { PortfolioEditor } from "./PortfolioEditor";

type Props = {
  seed: PortfolioConfig;
};

export function PortfolioShell({ seed }: Props) {
  const [portfolio, setPortfolio] = useState<PortfolioConfig>(seed);
  const [hydrated, setHydrated] = useState(false);
  const [quotes, setQuotes] = useState<QuoteResult[]>([]);
  const [audPerUsd, setAudPerUsd] = useState<number | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Seed from JSON, then overlay localStorage on the client
  useEffect(() => {
    setPortfolio(loadPortfolioFromSources(seed));
    setHydrated(true);
  }, [seed]);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    savePortfolioToStorage(portfolio);
  }, [portfolio, hydrated]);

  const securityTickersKey = useMemo(
    () =>
      portfolio.holdings
        .filter((h) => h.kind === "security")
        .map((h) => h.ticker.toUpperCase())
        .sort()
        .join(","),
    [portfolio.holdings],
  );

  const fetchQuotes = useCallback(async () => {
    // Always fetch AUDUSD when we have USD costs or collectables in USD,
    // even with zero security tickers — use a sentinel request via any USD holding.
    const needsFx =
      portfolio.holdings.some(
        (h) =>
          h.costCurrency === "USD" ||
          (h.kind === "collectable" && h.estimatedValueCurrency === "USD"),
      ) || securityTickersKey.length > 0;

    if (!needsFx) {
      setQuotes([]);
      setAudPerUsd(null);
      setQuotesError(null);
      setQuotesLoading(false);
      return;
    }

    setQuotesLoading(true);
    try {
      const qs = securityTickersKey
        ? `tickers=${encodeURIComponent(securityTickersKey)}`
        : "fxOnly=1";
      const res = await fetch(`/api/portfolio-quotes?${qs}`);
      const data = (await res.json()) as {
        quotes?: QuoteResult[];
        audPerUsd?: number | null;
        error?: string | null;
      };
      if (!res.ok) {
        setQuotesError(data.error || `HTTP ${res.status}`);
        setQuotes(data.quotes ?? []);
        setAudPerUsd(data.audPerUsd ?? null);
      } else {
        setQuotes(data.quotes ?? []);
        setAudPerUsd(data.audPerUsd ?? null);
        setQuotesError(data.error || null);
      }
    } catch (e) {
      setQuotesError(e instanceof Error ? e.message : "Quote fetch failed");
    } finally {
      setQuotesLoading(false);
    }
  }, [securityTickersKey, portfolio.holdings]);

  useEffect(() => {
    if (!hydrated) return;
    void fetchQuotes();
    const id = window.setInterval(() => void fetchQuotes(), 60_000);
    return () => window.clearInterval(id);
  }, [hydrated, fetchQuotes]);

  const { holdings: liveHoldings, summary } = useMemo(
    () => computeLiveHoldings(portfolio, quotes, audPerUsd),
    [portfolio, quotes, audPerUsd],
  );

  const editing = useMemo(
    () => (editingId ? portfolio.holdings.find((h) => h.id === editingId) ?? null : null),
    [editingId, portfolio.holdings],
  );

  const hasHoldings = portfolio.holdings.length > 0;

  function openAdd() {
    setEditingId(null);
    setEditorOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setEditorOpen(true);
  }

  function openMeta() {
    setEditingId(null);
    setEditorOpen(true);
  }

  function saveHolding(holding: PortfolioHolding) {
    setPortfolio((prev) => {
      const idx = prev.holdings.findIndex((h) => h.id === holding.id);
      const color =
        holding.color ??
        (idx >= 0
          ? prev.holdings[idx].color
          : HOLDING_COLORS[prev.holdings.length % HOLDING_COLORS.length]);
      const nextHolding = { ...holding, color };
      if (idx >= 0) {
        const holdings = [...prev.holdings];
        holdings[idx] = nextHolding;
        return { ...prev, holdings };
      }
      // Same ticker security → replace existing (collectables allow duplicate names)
      if (nextHolding.kind === "security") {
        const byTicker = prev.holdings.findIndex(
          (h) =>
            h.kind === "security" &&
            h.ticker.toUpperCase() === nextHolding.ticker.toUpperCase() &&
            h.id !== nextHolding.id,
        );
        if (byTicker >= 0) {
          const holdings = [...prev.holdings];
          holdings[byTicker] = {
            ...nextHolding,
            id: holdings[byTicker].id,
            color: holdings[byTicker].color,
          };
          return { ...prev, holdings };
        }
      }
      return { ...prev, holdings: [...prev.holdings, nextHolding] };
    });
  }

  function deleteHolding(id: string) {
    setPortfolio((prev) => ({
      ...prev,
      holdings: prev.holdings.filter((h) => h.id !== id),
    }));
  }

  function updateMeta(patch: Partial<Pick<PortfolioConfig, "name" | "availableCashAud">>) {
    setPortfolio((prev) => ({ ...prev, ...patch }));
  }

  function clearAll() {
    clearPortfolioStorage();
    setPortfolio({ ...DEFAULT_PORTFOLIO, holdings: [] });
    setQuotes([]);
    setAudPerUsd(null);
    setEditorOpen(false);
  }

  function doExport() {
    const json = exportPortfolioJson(portfolio);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adirindin-portfolio.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport(file: File) {
    try {
      const text = await file.text();
      const next = importPortfolioJson(text);
      setPortfolio(next);
      setEditorOpen(false);
    } catch {
      window.alert("Could not import JSON — check the file format.");
    }
  }

  const showSummary =
    hasHoldings || (portfolio.availableCashAud != null && portfolio.availableCashAud > 0);

  return (
    <div className="mx-auto max-w-2xl bg-black px-4 py-8 sm:px-6 sm:py-10">
      <PortfolioSummary
        portfolioName={portfolio.name}
        hasHoldings={showSummary}
        summary={showSummary ? summary : null}
        quotesLoading={quotesLoading}
        quotesError={quotesError}
        onEditName={openMeta}
        onAdd={openAdd}
      />
      <PerformanceChart portfolio={portfolio} hasHoldings={hasHoldings} />
      <AllocationDonutEmpty holdings={liveHoldings} cashAud={summary.cashAud} />
      <HoldingsListEmpty
        holdings={liveHoldings}
        availableCashAud={portfolio.availableCashAud}
        onEdit={openEdit}
        onAdd={openAdd}
        onEditCash={openMeta}
      />

      <p className="mt-10 text-center text-[11px] leading-relaxed text-zinc-600">
        NFA: Educational tracker only · Not financial advice. Quotes delayed · AUD via Yahoo.
      </p>

      <PortfolioEditor
        portfolio={portfolio}
        editing={editing}
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingId(null);
        }}
        onSaveHolding={saveHolding}
        onDeleteHolding={deleteHolding}
        onUpdateMeta={updateMeta}
        onClearAll={clearAll}
        onExport={doExport}
        onImport={doImport}
      />
    </div>
  );
}

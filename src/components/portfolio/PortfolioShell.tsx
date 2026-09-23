"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PortfolioConfig,
  PortfolioHolding,
  PortfolioTimeframe,
  QuoteResult,
} from "@/lib/portfolioTypes";
import { DEFAULT_PORTFOLIO, HOLDING_COLORS } from "@/lib/portfolioTypes";
import {
  DEFAULT_CHART_TIMEFRAME,
  readStoredChartTimeframe,
  readStoredDisplayCurrency,
  readStoredReturnsVsCost,
  toHomepageKey,
  toPortfolioTf,
  writeStoredChartTimeframe,
  writeStoredDisplayCurrency,
  writeStoredReturnsVsCost,
  type PortfolioDisplayCurrency,
} from "@/lib/chartTimeframes";
import {
  clearPortfolioStorage,
  exportPortfolioJson,
  importPortfolioJson,
  loadPortfolioFromSources,
  savePortfolioToStorage,
} from "@/lib/portfolioStorage";
import {
  applyPeriodReturns,
  computeLiveHoldings,
  computePeriodSummary,
  type PeriodTickerReturn,
} from "@/lib/portfolioCompute";
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
  /** Shared Performance / summary / holdings timeframe (localStorage-backed). */
  const [tf, setTf] = useState<PortfolioTimeframe>(() =>
    toPortfolioTf(DEFAULT_CHART_TIMEFRAME),
  );
  const [tfReady, setTfReady] = useState(false);
  /** Pin summary/holdings to cost basis; lock Performance chart to 1Y. Portfolio-only. */
  const [returnsVsCost, setReturnsVsCost] = useState(true);
  /** Display-only AUD|USD toggle (bookkeeping stays AUD). */
  const [displayCurrency, setDisplayCurrency] = useState<PortfolioDisplayCurrency>("AUD");
  const [periodReturns, setPeriodReturns] = useState<PeriodTickerReturn[] | null>(null);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Seed from JSON, then overlay localStorage on the client
  useEffect(() => {
    setPortfolio(loadPortfolioFromSources(seed));
    setHydrated(true);
  }, [seed]);

  // Shared chart timeframe (homepage + Performance chips)
  useEffect(() => {
    setTf(toPortfolioTf(readStoredChartTimeframe(DEFAULT_CHART_TIMEFRAME)));
    setReturnsVsCost(readStoredReturnsVsCost(true));
    setDisplayCurrency(readStoredDisplayCurrency("AUD"));
    setTfReady(true);
  }, []);

  const selectTf = useCallback((next: PortfolioTimeframe) => {
    setTf(next);
    writeStoredChartTimeframe(toHomepageKey(next));
  }, []);

  const setReturnsVsCostPersist = useCallback((on: boolean) => {
    setReturnsVsCost(on);
    writeStoredReturnsVsCost(on);
  }, []);

  const setDisplayCurrencyPersist = useCallback((c: PortfolioDisplayCurrency) => {
    setDisplayCurrency(c);
    writeStoredDisplayCurrency(c);
  }, []);

  /** Chart timeframe: locked to 1Y while vs-cost is on. */
  const chartTf: PortfolioTimeframe = returnsVsCost ? "1Y" : tf;
  /** Summary + holdings market window: follow chip (including ALL). Vs cost skips fetch. */
  const returnsTf: PortfolioTimeframe = tf;

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
    // Always fetch AUDUSD when display is USD, or when we have USD costs /
    // collectables in USD / security tickers — use fxOnly=1 when no tickers.
    const needsFx =
      displayCurrency === "USD" ||
      portfolio.holdings.some(
        (h) =>
          h.costCurrency === "USD" ||
          (h.kind === "collectable" && h.estimatedValueCurrency === "USD"),
      ) ||
      securityTickersKey.length > 0;

    if (!needsFx) {
      setQuotes([]);
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
      const nextFx =
        data.audPerUsd != null && data.audPerUsd > 0 ? data.audPerUsd : null;
      if (!res.ok) {
        setQuotesError(data.error || `HTTP ${res.status}`);
        setQuotes(data.quotes ?? []);
        // Keep last known FX — do not invent a rate.
        if (nextFx != null) setAudPerUsd(nextFx);
      } else {
        setQuotes(data.quotes ?? []);
        if (nextFx != null) setAudPerUsd(nextFx);
        setQuotesError(data.error || null);
      }
    } catch (e) {
      setQuotesError(e instanceof Error ? e.message : "Quote fetch failed");
    } finally {
      setQuotesLoading(false);
    }
  }, [securityTickersKey, portfolio.holdings, displayCurrency]);

  useEffect(() => {
    if (!hydrated) return;
    void fetchQuotes();
    const id = window.setInterval(() => void fetchQuotes(), 60_000);
    return () => window.clearInterval(id);
  }, [hydrated, fetchQuotes]);

  const fetchPeriodReturns = useCallback(async () => {
    // Vs cost: personal cost-basis gains already on live holdings — skip API.
    if (returnsVsCost) {
      setPeriodReturns(null);
      setReturnsError(null);
      setReturnsLoading(false);
      return;
    }
    if (!securityTickersKey) {
      setPeriodReturns([]);
      setReturnsError(null);
      setReturnsLoading(false);
      return;
    }
    setReturnsLoading(true);
    try {
      const res = await fetch(
        `/api/portfolio-returns?tf=${encodeURIComponent(returnsTf)}&tickers=${encodeURIComponent(securityTickersKey)}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        returns?: PeriodTickerReturn[];
        error?: string;
      };
      if (!res.ok || data.ok === false) {
        setReturnsError(data.error || `HTTP ${res.status}`);
        setPeriodReturns(data.returns ?? null);
      } else {
        setPeriodReturns(data.returns ?? []);
        setReturnsError(null);
      }
    } catch (e) {
      setReturnsError(e instanceof Error ? e.message : "Returns fetch failed");
      setPeriodReturns(null);
    } finally {
      setReturnsLoading(false);
    }
  }, [returnsVsCost, returnsTf, securityTickersKey]);

  useEffect(() => {
    if (!hydrated || !tfReady) return;
    void fetchPeriodReturns();
  }, [hydrated, tfReady, fetchPeriodReturns]);

  const { holdings: baseLiveHoldings, summary } = useMemo(
    () => computeLiveHoldings(portfolio, quotes, audPerUsd),
    [portfolio, quotes, audPerUsd],
  );

  const liveHoldings = useMemo(() => {
    if (returnsVsCost) return baseLiveHoldings; // cost gains already present
    return applyPeriodReturns(baseLiveHoldings, periodReturns, returnsTf);
  }, [returnsVsCost, baseLiveHoldings, periodReturns, returnsTf]);

  const periodSummary = useMemo(() => {
    if (returnsVsCost) {
      return {
        totalGainAud: summary.totalGainAud,
        totalGainPct: summary.totalGainPct,
        available: summary.totalGainPct != null,
      };
    }
    return computePeriodSummary(baseLiveHoldings, periodReturns, returnsTf, summary);
  }, [returnsVsCost, baseLiveHoldings, periodReturns, returnsTf, summary]);

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
    let addedId: string | null = null;

    setPortfolio((prev) => {
      const idx = prev.holdings.findIndex((h) => h.id === holding.id);
      const color =
        holding.color ??
        (idx >= 0
          ? prev.holdings[idx]!.color
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
          const keptId = holdings[byTicker]!.id;
          holdings[byTicker] = {
            ...nextHolding,
            id: keptId,
            color: holdings[byTicker]!.color,
          };
          addedId = keptId;
          return { ...prev, holdings };
        }
      }
      addedId = nextHolding.id;
      return { ...prev, holdings: [...prev.holdings, nextHolding] };
    });

    if (addedId) {
      setJustAddedId(addedId);
      window.setTimeout(() => setJustAddedId(null), 3200);
    }
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

  const fxOk = audPerUsd != null && audPerUsd > 0;
  /** Prefer USD when selected and FX is known; otherwise fall back to AUD (no invented rates). */
  const effectiveDisplay: PortfolioDisplayCurrency =
    displayCurrency === "USD" && fxOk ? "USD" : "AUD";
  const fxUnavailableHint =
    displayCurrency === "USD" && !fxOk ? "FX unavailable — showing A$" : null;

  return (
    <div className="mx-auto max-w-2xl bg-black px-4 py-8 sm:px-6 sm:py-10">
      <PortfolioSummary
        portfolioName={portfolio.name}
        hasHoldings={showSummary}
        summary={showSummary ? summary : null}
        periodGainAud={periodSummary.totalGainAud}
        periodGainPct={periodSummary.totalGainPct}
        periodAvailable={periodSummary.available}
        returnWindow={returnsTf}
        useCostBasis={returnsVsCost}
        returnsLoading={returnsLoading}
        quotesLoading={quotesLoading}
        quotesError={quotesError}
        returnsError={returnsError}
        displayCurrency={displayCurrency}
        effectiveDisplay={effectiveDisplay}
        audPerUsd={audPerUsd}
        fxUnavailableHint={fxUnavailableHint}
        onDisplayCurrencyChange={setDisplayCurrencyPersist}
        onEditName={openMeta}
        onAdd={openAdd}
      />
      <PerformanceChart
        portfolio={portfolio}
        hasHoldings={hasHoldings}
        tf={chartTf}
        onTfChange={selectTf}
        returnsVsCost={returnsVsCost}
        onReturnsVsCostChange={setReturnsVsCostPersist}
        chipsLocked={returnsVsCost}
      />
      <AllocationDonutEmpty
        holdings={liveHoldings}
        cashAud={summary.cashAud}
        displayCurrency={effectiveDisplay}
        audPerUsd={audPerUsd}
      />
      <HoldingsListEmpty
        holdings={liveHoldings}
        availableCashAud={portfolio.availableCashAud}
        returnWindow={returnsTf}
        useCostBasis={returnsVsCost}
        returnsLoading={returnsLoading}
        highlightId={justAddedId}
        displayCurrency={effectiveDisplay}
        audPerUsd={audPerUsd}
        onEdit={openEdit}
        onAdd={openAdd}
        onEditCash={openMeta}
      />


      <p className="mt-10 text-center text-[11px] leading-relaxed text-zinc-600">
        NFA: Educational tracker only · not financial advice · not an AFSL product. Security quotes
        and AUD FX via Yahoo Finance (may be delayed). Spot-crypto logos via{" "}
        <a
          href="https://www.coingecko.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-400"
        >
          CoinGecko
        </a>
        ; equity/ETF logos via{" "}
        <a
          href="https://logo.dev"
          target="_blank"
          rel="noopener"
          className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-400"
        >
          Logo.dev
        </a>
        . Trademarks remain with their owners · unavailable logos use initials.
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

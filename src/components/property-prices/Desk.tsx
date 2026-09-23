"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PriceChart } from "@/components/property-prices/PriceChart";
import { Button, FieldLabel, Panel, SelectInput, TextInput } from "@/components/property-prices/ui";
import { performanceOf } from "@/lib/rea/chart";
import {
  RANGE_OPTIONS,
  type OverlayKey,
  type RangeKey,
} from "@/lib/rea/market";
import {
  lastSnapshotDate,
  latestMark,
  MARK_METHODS,
  PROPERTY_TYPES,
  sleeveSum,
  useReaStore,
} from "@/lib/rea/store";
import type { MarkMethod, PropertyStatus, PropertyType, ReaState } from "@/lib/rea/types";
import { parseListingUrl } from "@/lib/rea/lookup";
import { aud, cn, parseAuAddress, signedAud, signedPct } from "@/lib/utils";

export function PropertyPricesDesk() {
  const hydrate = useReaStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Tools · Real estate
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">
              Property prices
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-muted">
              Dated public marks and suburb-indexed paths for titles on the
              watchlist. Paste a mid from realestate.com.au or Domain — this
              desk does not scrape. Educational framing only; not a valuation
              or personal financial advice (NFA).
            </p>
          </div>
          <DeskFiles />
        </div>
        <div className="mt-8">
          <Stats />
        </div>
        <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[1.6fr_0.9fr]">
          <ChartPanel />
          <AddProperty />
        </div>
        <div className="mt-4">
          <Compare />
        </div>
        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[1.6fr_0.9fr]">
          <Watchlist />
          <MarkForm />
        </div>
        <div className="mt-4 min-w-0">
          <SnapshotLog />
        </div>
        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
          Research tool for Adirindin Finance. Estimates are labelled. The
          chart path is a suburb-indexed proxy, not a valuation of the
          address. Overlay medians are sale medians. Not financial advice.
          Source pages stay on realestate.com.au / Domain / Valuer-General
          Victoria — this desk stores dated public prints.{" "}
          <a className="text-accent hover:underline" href="/">
            Adirindin Finance
          </a>
          {" · "}
          <a
            className="text-accent hover:underline"
            href="https://x.com/Dirindin533"
            target="_blank"
            rel="noopener noreferrer"
          >
            @Dirindin533
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function DeskFiles() {
  const fileRef = useRef<HTMLInputElement>(null);
  const exportState = useReaStore((s) => s.exportState);
  const importState = useReaStore((s) => s.importState);

  function onExport() {
    const blob = new Blob([JSON.stringify(exportState(), null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `adirindin-rea-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as ReaState;
        if (!data.properties) throw new Error("bad file");
        importState(data);
        window.alert("Imported");
      } catch {
        window.alert("Could not read that file");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <Button variant="ghost" onClick={onExport}>
        Export
      </Button>
      <Button variant="ghost" onClick={() => fileRef.current?.click()}>
        Import
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Stats() {
  const properties = useReaStore((s) => s.properties);
  const watch = sleeveSum(properties, "watch");
  const owned = sleeveSum(properties, "owned");
  const asOf = lastSnapshotDate(properties);
  const items = [
    { label: "Properties", value: String(properties.length) },
    { label: "Watchlist total", value: watch ? aud(watch) : "—" },
    { label: "Owned total", value: owned ? aud(owned) : "—" },
    { label: "Last snapshot", value: asOf ?? "—" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            {it.label}
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartPanel() {
  const all = useReaStore((s) => s.properties);
  const properties = all.filter((p) => p.charted !== false);
  const [scale, setScale] = useState<"aud" | "rel">("aud");
  const [mode, setMode] = useState<"each" | "sleeves" | "both">("each");
  const [range, setRange] = useState<RangeKey>("20");
  const [overlay, setOverlay] = useState<OverlayKey>("australia");
  return (
    <Panel title="Property prices" kicker="hover for $ and % · NFA">
      <div className="mb-3">
        <FieldLabel>Window</FieldLabel>
        <div
          role="tablist"
          aria-label="Chart window"
          className="inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-card-2 p-1"
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={range === opt.id}
              className={cn(
                "min-h-11 min-w-11 rounded-md px-3 text-xs font-semibold uppercase tracking-wide transition-colors duration-150",
                range === opt.id
                  ? "bg-accent text-accent-fg"
                  : "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground",
              )}
              onClick={() => setRange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <FieldLabel htmlFor="scale">Scale</FieldLabel>
          <SelectInput
            id="scale"
            value={scale}
            onChange={(e) => setScale(e.target.value as "aud" | "rel")}
          >
            <option value="aud">AUD mid</option>
            <option value="rel">Relative % in window</option>
          </SelectInput>
        </div>
        <div className="min-w-0">
          <FieldLabel htmlFor="mode">Show</FieldLabel>
          <SelectInput
            id="mode"
            value={mode}
            onChange={(e) =>
              setMode(e.target.value as "each" | "sleeves" | "both")
            }
          >
            <option value="each">Each property</option>
            <option value="sleeves">Totals only</option>
            <option value="both">Properties + totals</option>
          </SelectInput>
        </div>
        <div className="min-w-0">
          <FieldLabel htmlFor="overlay">Overlay</FieldLabel>
          <SelectInput
            id="overlay"
            value={overlay}
            onChange={(e) => setOverlay(e.target.value as OverlayKey)}
          >
            <option value="none">Off</option>
            <option value="australia">Australia mean (ABS)</option>
            <option value="melbourne">Melbourne houses</option>
            <option value="suburbs">Suburb medians (VGV)</option>
          </SelectInput>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-black p-2 md:p-3">
        <PriceChart
          properties={properties}
          scale={scale}
          mode={mode}
          range={range}
          overlay={overlay}
        />
      </div>
    </Panel>
  );
}

function MarkForm() {
  const properties = useReaStore((s) => s.properties);
  const logMark = useReaStore((s) => s.logMark);
  const [id, setId] = useState(properties[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<MarkMethod>("estimate");
  const [low, setLow] = useState("");
  const [mid, setMid] = useState("");
  const [high, setHigh] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!date) setDate(new Date().toISOString().slice(0, 10));
  }, [date]);

  useEffect(() => {
    if (!properties.find((p) => p.id === id) && properties[0]) {
      setId(properties[0].id);
    }
  }, [properties, id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const midN = Number(mid);
    if (!id || !date || !midN) {
      window.alert("Need property, date and mid");
      return;
    }
    logMark(id, {
      date,
      mid: midN,
      low: low === "" ? midN : Number(low),
      high: high === "" ? midN : Number(high),
      method,
      note: note.trim(),
    });
    setMid("");
    setLow("");
    setHigh("");
    setNote("");
    window.alert("Mark logged");
  }

  return (
    <Panel title="Log a sale / estimate">
      <form onSubmit={submit} className="space-y-2">
        <FieldLabel htmlFor="snap-prop">Property</FieldLabel>
        <SelectInput id="snap-prop" value={id} onChange={(e) => setId(e.target.value)}>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}, {p.suburb}
            </option>
          ))}
        </SelectInput>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel htmlFor="snap-date">Date</FieldLabel>
            <TextInput
              id="snap-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="snap-method">Method</FieldLabel>
            <SelectInput
              id="snap-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as MarkMethod)}
            >
              {MARK_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="snap-low">Low AUD</FieldLabel>
            <TextInput
              id="snap-low"
              type="number"
              min={0}
              step={1000}
              value={low}
              onChange={(e) => setLow(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="snap-mid">Mid AUD</FieldLabel>
            <TextInput
              id="snap-mid"
              type="number"
              min={0}
              step={1000}
              value={mid}
              onChange={(e) => setMid(e.target.value)}
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="snap-high">High AUD</FieldLabel>
            <TextInput
              id="snap-high"
              type="number"
              min={0}
              step={1000}
              value={high}
              onChange={(e) => setHigh(e.target.value)}
            />
          </div>
        </div>
        <FieldLabel htmlFor="snap-note">Note / source</FieldLabel>
        <TextInput
          id="snap-note"
          placeholder="e.g. REA realEstimate 14 Sep 2026"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="pt-2">
          <Button type="submit" variant="primary" className="w-full">
            Log mark
          </Button>
        </div>
        <p className="text-xs text-muted">
          Paste the mid from the property page. Do not type a suburb median as
          if it were the house.
        </p>
      </form>
    </Panel>
  );
}

function Compare() {
  const properties = useReaStore((s) => s.properties);
  return (
    <Panel title="Compare">
      <p className="mb-3 text-xs text-muted">
        Public prints only — first mid to last mid. The chart's suburb-proxy
        path is not used here.
      </p>
      <div className="space-y-3 md:hidden">
        {properties.map((p) => {
          const perf = performanceOf(p);
          return (
            <div key={p.id} className="rounded-lg border border-border bg-navy p-3">
              <div className="font-medium text-foreground">{p.address}</div>
              <div className="text-xs text-muted">
                {p.suburb} · {p.status} · {perf.n} mark{perf.n === 1 ? "" : "s"}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm tabular-nums">
                <div>
                  <div className="text-xs text-muted">First</div>
                  {perf.first?.value != null ? aud(perf.first.value) : "—"}
                </div>
                <div>
                  <div className="text-xs text-muted">Last</div>
                  {perf.last?.value != null ? aud(perf.last.value) : "—"}
                </div>
                <div>
                  <div className="text-xs text-muted">Change</div>
                  {signedAud(perf.delta)}
                </div>
                <div>
                  <div className="text-xs text-muted">Vs first</div>
                  {signedPct(perf.pct)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-2">Property</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">First mid</th>
              <th className="py-2 pr-2">Last mid</th>
              <th className="py-2 pr-2">Change</th>
              <th className="py-2">Vs first</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => {
              const perf = performanceOf(p);
              return (
                <tr key={p.id} className="border-b border-border/70">
                  <td className="py-3 pr-2">
                    <div className="font-medium text-foreground">{p.address}</div>
                    <div className="text-xs text-muted">{p.suburb}</div>
                  </td>
                  <td className="py-3 pr-2 text-xs">{p.status}</td>
                  <td className="py-3 pr-2 font-mono tabular-nums">
                    {perf.first?.value != null ? aud(perf.first.value) : "—"}
                    <div className="text-xs text-muted">{perf.first?.date ?? ""}</div>
                  </td>
                  <td className="py-3 pr-2 font-mono tabular-nums">
                    {perf.last?.value != null ? aud(perf.last.value) : "—"}
                    <div className="text-xs text-muted">{perf.last?.date ?? ""}</div>
                  </td>
                  <td className="py-3 pr-2 font-mono tabular-nums">
                    {signedAud(perf.delta)}
                  </td>
                  <td className="py-3 font-mono tabular-nums">{signedPct(perf.pct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Watchlist() {
  const properties = useReaStore((s) => s.properties);
  const flipStatus = useReaStore((s) => s.flipStatus);
  const removeProperty = useReaStore((s) => s.removeProperty);
  return (
    <Panel title="Watchlist">
      <div className="space-y-3 md:hidden">
        {properties.map((p) => {
          const m = latestMark(p);
          return (
            <div key={p.id} className="rounded-lg border border-border bg-navy p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-foreground">{p.address}</div>
                  <div className="text-xs text-muted">
                    {p.suburb} {p.postcode} · {p.type}
                    {p.url ? (
                      <>
                        {" · "}
                        <a
                          className="text-accent underline-offset-2 hover:underline"
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          profile
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
                <span
                  className={
                    p.status === "owned"
                      ? "rounded-full bg-ok/15 px-2 py-0.5 text-xs text-ok"
                      : "rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent"
                  }
                >
                  {p.status}
                </span>
              </div>
              <div className="mt-2 font-mono text-sm tabular-nums">
                {m ? aud(m.mid) : "—"}
                <span className="ml-2 text-xs text-muted">
                  {m ? `${m.date} · ${m.method}` : "unresolved"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  className="min-h-11 px-3 text-xs"
                  onClick={() => flipStatus(p.id)}
                >
                  {p.status === "owned" ? "make watch" : "make owned"}
                </Button>
                <Button
                  variant="danger"
                  className="min-h-11 px-3 text-xs"
                  onClick={() => removeProperty(p.id)}
                >
                  remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-2">Property</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Last mid</th>
              <th className="py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => {
              const m = latestMark(p);
              return (
                <tr key={p.id} className="border-b border-border/70 align-top">
                  <td className="py-3 pr-2">
                    <div className="font-medium text-foreground">{p.address}</div>
                    <div className="text-xs text-muted">
                      {p.suburb} {p.postcode} · {p.type}
                      {p.url ? (
                        <>
                          {" · "}
                          <a
                            className="text-accent underline-offset-2 hover:underline"
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            profile
                          </a>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 pr-2">
                    <span
                      className={
                        p.status === "owned"
                          ? "rounded-full bg-ok/15 px-2 py-0.5 text-xs text-ok"
                          : "rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent"
                      }
                    >
                      {p.status}
                    </span>
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        className="min-h-9 px-2 text-xs"
                        onClick={() => flipStatus(p.id)}
                      >
                        {p.status === "owned" ? "make watch" : "make owned"}
                      </Button>
                    </div>
                  </td>
                  <td className="py-3 pr-2 font-mono tabular-nums">
                    {m ? aud(m.mid) : "—"}
                    <div className="text-xs text-muted">{m ? m.date : "no mark"}</div>
                    {m ? (
                      <div className="mt-1 text-xs text-muted">{m.method}</div>
                    ) : (
                      <div className="mt-1 text-xs text-warn">unresolved</div>
                    )}
                  </td>
                  <td className="py-3">
                    <Button
                      variant="danger"
                      className="min-h-9 px-2 text-xs"
                      onClick={() => removeProperty(p.id)}
                    >
                      remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AddProperty() {
  const properties = useReaStore((s) => s.properties);
  const addProperty = useReaStore((s) => s.addProperty);
  const removeProperty = useReaStore((s) => s.removeProperty);
  const setCharted = useReaStore((s) => s.setCharted);
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [type, setType] = useState<PropertyType>("house");
  const [status, setStatus] = useState<PropertyStatus>("watch");
  const [url, setUrl] = useState("");
  const [history, setHistory] = useState("");
  const [mid, setMid] = useState("");
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) setDate(new Date().toISOString().slice(0, 10));
  }, [date]);

  function applyUrl(raw: string) {
    setUrl(raw);
    const parsed = parseListingUrl(raw);
    if (!parsed) return;
    if (parsed.address) setAddress(parsed.address);
    if (parsed.suburb) setSuburb(parsed.suburb);
    if (parsed.postcode) setPostcode(parsed.postcode);
    if (parsed.type && parsed.type !== "unknown") setType(parsed.type);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const link = url.trim();
    setBusy(true);
    try {
      let street = address.trim();
      let sub = suburb.trim();
      let pc = postcode.trim();
      let kind = type;
      let marks = undefined as
        | {
            date: string;
            low: number;
            mid: number;
            high: number;
            method: MarkMethod;
            note: string;
          }[]
        | undefined;
      if (link) {
        const res = await fetch("/api/rea-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: link, history }),
        });
        const found = res.ok ? await res.json() : null;
        if (found) {
          street = street || found.address;
          sub = sub || found.suburb;
          pc = pc || found.postcode;
          if (kind === "house" && found.type !== "unknown") kind = found.type;
          marks = found.marks;
          setAddress(street);
          setSuburb(sub);
          setPostcode(pc);
          setType(kind);
        } else {
          const parsed = parseListingUrl(link);
          if (parsed) {
            street = street || parsed.address || "";
            sub = sub || parsed.suburb || "";
            pc = pc || parsed.postcode || "";
            if (parsed.type && parsed.type !== "unknown") kind = parsed.type;
          }
        }
      }
      if (!street) {
        const parsed = parseAuAddress(address);
        street = (parsed.suburb ? parsed.address : address).trim();
        sub = sub || parsed.suburb;
        pc = pc || parsed.postcode;
      }
      if (!street && sub) street = `Property in ${sub}`;
      if (!street || !sub) {
        setMsg("Paste a realestate.com.au / Domain profile link, or a street and suburb.");
        return;
      }
      const midN = mid === "" ? null : Number(mid.replace(/[,$\s]/g, ""));
      if (mid !== "" && (!midN || midN <= 0)) {
        setMsg("Mid has to be a number if you fill it.");
        return;
      }
      if (midN && date) {
        const extra = {
          date,
          mid: midN,
          low: midN,
          high: midN,
          method: "manual" as const,
          note: "typed mid",
        };
        marks = [...(marks ?? []).filter((m) => m.date !== date), extra];
      }
      addProperty({
        address: street,
        suburb: sub,
        postcode: pc,
        type: kind,
        status,
        url: link,
        marks,
      });
      const sales = (marks ?? []).filter((m) => m.method === "sale").length;
      setAddress("");
      setSuburb("");
      setPostcode("");
      setUrl("");
      setHistory("");
      setMid("");
      setMsg(
        sales
          ? `Added ${street}, ${sub} — ${sales} sale print(s) on the chart from the listing.`
          : marks?.length
            ? `Added ${street}, ${sub} — listing estimate on the chart.`
            : `Added ${street}, ${sub}. No disclosed sale on that page, so the line is the area median until a sale is logged.`,
      );
    } catch {
      setMsg("Could not read that listing. Check the link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Add a property">
      <form onSubmit={submit} className="space-y-2" noValidate>
        <FieldLabel htmlFor="p-url">realestate.com.au / Domain link</FieldLabel>
        <TextInput
          id="p-url"
          type="text"
          inputMode="url"
          placeholder="Paste a realestate.com.au or Domain property link"
          value={url}
          onChange={(e) => applyUrl(e.target.value)}
        />
        <FieldLabel htmlFor="p-history">
          Property history from the REA page (sold prices)
        </FieldLabel>
        <textarea
          id="p-history"
          rows={4}
          placeholder="Paste sold-price lines from the listing (optional)"
          value={history}
          onChange={(e) => setHistory(e.target.value)}
          className="w-full rounded-md border border-border bg-navy px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted focus:border-accent/50 focus:ring-2"
        />
        <FieldLabel htmlFor="p-address">Address (filled from the link)</FieldLabel>
        <TextInput
          id="p-address"
          placeholder="Street address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="street-address"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel htmlFor="p-suburb">Suburb</FieldLabel>
            <TextInput
              id="p-suburb"
              placeholder="Suburb"
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-pc">Postcode</FieldLabel>
            <TextInput
              id="p-pc"
              inputMode="numeric"
              placeholder="Postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel htmlFor="p-type">Type</FieldLabel>
            <SelectInput
              id="p-type"
              value={type}
              onChange={(e) => setType(e.target.value as PropertyType)}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="p-status">Status</FieldLabel>
            <SelectInput
              id="p-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as PropertyStatus)}
            >
              <option value="watch">watch</option>
              <option value="owned">owned</option>
            </SelectInput>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel htmlFor="p-mid">Extra mid AUD (optional)</FieldLabel>
            <TextInput
              id="p-mid"
              inputMode="numeric"
              placeholder="if the page hid the price"
              value={mid}
              onChange={(e) => setMid(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-date">Print date</FieldLabel>
            <TextInput
              id="p-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="pt-2">
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Reading listing…" : "Add property"}
          </Button>
        </div>
        {msg ? <p className="text-xs text-ok">{msg}</p> : null}
        <p className="text-xs text-muted">
          Paste the profile link. Sold prints are read from the listing
          record automatically. The history box is only if a sale was hidden.
        </p>
      </form>
      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
          On the chart
        </p>
        {properties.length === 0 ? (
          <p className="text-xs text-muted">No titles yet — only the ABS average is plotted.</p>
        ) : (
          <ul className="space-y-2">
            {properties.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-navy px-2 py-2"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-accent"
                    checked={p.charted !== false}
                    onChange={(e) => setCharted(p.id, e.target.checked)}
                  />
                  <span className="truncate text-foreground">{p.address}</span>
                </label>
                <Button
                  type="button"
                  variant="danger"
                  className="min-h-9 shrink-0 px-2 text-xs"
                  onClick={() => removeProperty(p.id)}
                >
                  remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function SnapshotLog() {
  const properties = useReaStore((s) => s.properties);
  const removeMark = useReaStore((s) => s.removeMark);
  const rows = properties
    .flatMap((p) => p.marks.map((m) => ({ p, m })))
    .sort((a, b) => b.m.date.localeCompare(a.m.date));

  return (
    <Panel title="Snapshot log">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          No snapshots yet. Log a mark from a property page.
        </p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map(({ p, m }) => (
              <div
                key={`${p.id}-${m.date}-${m.mid}`}
                className="rounded-lg border border-border bg-navy p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs text-muted">{m.date}</div>
                    <div className="font-medium text-foreground">{p.address}</div>
                  </div>
                  <Button
                    variant="danger"
                    className="min-h-11 px-3 text-xs"
                    onClick={() => removeMark(p.id, m.date, m.mid)}
                  >
                    remove
                  </Button>
                </div>
                <div className="mt-2 font-mono text-sm tabular-nums">
                  {aud(m.mid)}
                  <span className="ml-2 text-xs text-muted">
                    {aud(m.low)} – {aud(m.high)} · {m.method}
                  </span>
                </div>
                {m.note ? (
                  <p className="mt-1 text-xs text-muted">{m.note}</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Property</th>
                  <th className="py-2 pr-2">Low</th>
                  <th className="py-2 pr-2">Mid</th>
                  <th className="py-2 pr-2">High</th>
                  <th className="py-2 pr-2">Method</th>
                  <th className="py-2 pr-2">Note</th>
                  <th className="py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, m }) => (
                  <tr
                    key={`${p.id}-${m.date}-${m.mid}`}
                    className="border-b border-border/70"
                  >
                    <td className="py-2 pr-2 font-mono text-xs">{m.date}</td>
                    <td className="py-2 pr-2">{p.address}</td>
                    <td className="py-2 pr-2 font-mono tabular-nums">{aud(m.low)}</td>
                    <td className="py-2 pr-2 font-mono tabular-nums">{aud(m.mid)}</td>
                    <td className="py-2 pr-2 font-mono tabular-nums">{aud(m.high)}</td>
                    <td className="py-2 pr-2 text-xs">{m.method}</td>
                    <td className="py-2 pr-2 text-xs text-muted">{m.note}</td>
                    <td className="py-2">
                      <Button
                        variant="danger"
                        className="min-h-8 px-2 text-xs"
                        onClick={() => removeMark(p.id, m.date, m.mid)}
                      >
                        remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

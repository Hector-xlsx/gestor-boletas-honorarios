"use client";

import { useEffect, useMemo, useState } from "react";

type Tab = "new" | "history" | "settings";
type TimeMode = "single" | "total" | "perDay";
type ValueSource = "manual" | "saved";
type InvoiceStatus = "Pendiente de emitir" | "Pendiente de pago" | "Boleta pagada";
type InvoiceTaxType = "receptor_retiene" | "emisor_paga_ppm";

type TaxRate = {
  year: number;
  rate: number;
};

type TaxSnapshot = {
  issueYear: number;
  taxRateUsed: number;
  totalHonorarios: number;
  retencion: number;
  ppm: number;
  pagoDesdeReceptor: number;
  netoDespuesImpuesto: number;
  montoAIngresarSii: number;
};

type SavedRate = {
  id: string;
  name: string;
  amount: number;
};

type Institution = {
  id: string;
  name: string;
  invoiceTaxType: InvoiceTaxType;
};

type Entry = {
  id: string;
  startDate: string;
  endDate: string;
  timeMode: TimeMode;
  daysCount: number;
  hours: number;
  minutes: number;
  hoursPerDay: number;
  minutesPerDay: number;
  valueName: string;
  valueAmount: number;
  valueSource: ValueSource;
  comment: string;
};

type Invoice = {
  id: string;
  createdAt: string;
  institutionName: string;
  institutionSource: ValueSource;
  invoiceTaxType: InvoiceTaxType;
  entries: Entry[];
  invoiceNumber: string;
  invoiceDate: string;
  status: InvoiceStatus;
  gloss: string;
} & TaxSnapshot;

type Draft = {
  institutionName: string;
  institutionSource: ValueSource;
  invoiceTaxType: InvoiceTaxType;
  entries: Entry[];
  invoiceNumber: string;
  invoiceDate: string;
  status: InvoiceStatus;
  gloss: string;
};
type PeriodModal = { entryId: string; startDate: string; endDate: string; hasEndDate: boolean };
type TimeModal = Entry & { warnedOverDays: boolean };
type RateModal = { entryId: string; name: string; amount: string };
type ExportMode = "all" | "range" | "selected" | null;
type HistoryDateTarget = "invoice" | "period";
type HistoryFilters = {
  institution: string;
  taxType: "" | InvoiceTaxType;
  dateTarget: HistoryDateTarget;
  dateFrom: string;
  dateTo: string;
};

const STORAGE_KEYS = {
  rates: "cobro-horas-rates",
  institutions: "cobro-horas-institutions",
  invoices: "cobro-horas-invoices",
  taxRates: "cobro-horas-tax-rates",
};

const STATUSES: InvoiceStatus[] = [
  "Pendiente de emitir",
  "Pendiente de pago",
  "Boleta pagada",
];

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultRates: SavedRate[] = [
  { id: uid(), name: "Turno general", amount: 10000 },
  { id: uid(), name: "Turno festivo", amount: 20000 },
];

const defaultInstitutions: Institution[] = [
  { id: uid(), name: "CESFAM MAIPO", invoiceTaxType: "receptor_retiene" },
];

const defaultTaxRates: TaxRate[] = [
  { year: 2025, rate: 14.5 },
  { year: 2026, rate: 15.25 },
  { year: 2027, rate: 16 },
  { year: 2028, rate: 17 },
  { year: 2029, rate: 17 },
  { year: 2030, rate: 17 },
];

function createEntry(): Entry {
  return {
    id: uid(),
    startDate: today(),
    endDate: today(),
    timeMode: "single",
    daysCount: 1,
    hours: 0,
    minutes: 0,
    hoursPerDay: 0,
    minutesPerDay: 0,
    valueName: "",
    valueAmount: 0,
    valueSource: "manual",
    comment: "",
  };
}

function createDraft(): Draft {
  return {
    institutionName: "",
    institutionSource: "manual",
    invoiceTaxType: "receptor_retiene",
    entries: [createEntry()],
    invoiceNumber: "",
    invoiceDate: today(),
    status: "Pendiente de emitir",
    gloss: "",
  };
}

function parseStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveStored<T>(key: string, value: T) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function normalizeRates(items: SavedRate[]) {
  return items.map((item) => {
    if (item.name === "Turno general" && item.amount === 18000) {
      return { ...item, amount: 10000 };
    }
    if (item.name === "Turno festivo" && item.amount === 26000) {
      return { ...item, amount: 20000 };
    }
    return item;
  });
}

function normalizeInstitutions(items: Institution[]) {
  return items.map((item) => ({
    ...item,
    name: item.name === "Institución principal" ? "CESFAM MAIPO" : item.name,
    invoiceTaxType: item.invoiceTaxType || "receptor_retiene",
  }));
}

function normalizeTaxRates(items: TaxRate[]) {
  const byYear = new Map<number, number>();
  [...defaultTaxRates, ...items].forEach((item) => {
    if (Number.isFinite(item.year) && Number.isFinite(item.rate)) {
      byYear.set(item.year, item.rate);
    }
  });

  const currentYear = new Date().getFullYear();
  const minYear = Math.min(2025, currentYear);
  const maxYear = Math.max(2030, currentYear + 1);
  for (let year = minYear; year <= maxYear; year += 1) {
    if (!byYear.has(year)) {
      const previous = byYear.get(year - 1) ?? 17;
      byYear.set(year, previous);
    }
  }

  return Array.from(byYear.entries())
    .map(([year, rate]) => ({ year, rate }))
    .sort((a, b) => a.year - b.year);
}

function dateDiffInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

function sortDatePair(startDate: string, endDate: string) {
  return startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
}

function entryMinutes(entry: Entry) {
  if (entry.timeMode === "perDay") {
    return entry.daysCount * (entry.hoursPerDay * 60 + entry.minutesPerDay);
  }
  return entry.hours * 60 + entry.minutes;
}

function splitMinutes(totalMinutes: number) {
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

function entryAmount(entry: Entry) {
  return Math.round(entry.valueAmount * (entryMinutes(entry) / 60));
}

function isValidDateString(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function formatDate(date: string) {
  if (!isValidDateString(date)) return "-";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatHours(totalMinutes: number) {
  const split = splitMinutes(totalMinutes);
  return `${split.hours} h ${split.minutes} min`;
}

function invoiceTotals(invoice: Pick<Invoice, "entries">) {
  const totalMinutes = invoice.entries.reduce((sum, entry) => sum + entryMinutes(entry), 0);
  const amount = invoice.entries.reduce((sum, entry) => sum + entryAmount(entry), 0);
  const dates = invoice.entries.flatMap((entry) => [entry.startDate, entry.endDate]).filter(Boolean);
  return {
    totalMinutes,
    amount,
    from: dates.length ? dates.reduce((min, date) => (date < min ? date : min), dates[0]) : "",
    to: dates.length ? dates.reduce((max, date) => (date > max ? date : max), dates[0]) : "",
  };
}

function getIssueYear(invoiceDate: string) {
  const year = Number(invoiceDate.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : new Date().getFullYear();
}

function getTaxRateByYear(year: number, taxRates: TaxRate[]) {
  const exact = taxRates.find((item) => item.year === year);
  if (exact) return exact.rate;

  const previous = [...taxRates].sort((a, b) => b.year - a.year).find((item) => item.year < year);
  return previous?.rate ?? 17;
}

function calculateTaxSnapshot(totalHonorarios: number, invoiceTaxType: InvoiceTaxType, invoiceDate: string, taxRates: TaxRate[]): TaxSnapshot {
  const issueYear = getIssueYear(invoiceDate);
  const taxRateUsed = getTaxRateByYear(issueYear, taxRates);
  const tax = Math.round(totalHonorarios * (taxRateUsed / 100));

  if (invoiceTaxType === "receptor_retiene") {
    return {
      issueYear,
      taxRateUsed,
      totalHonorarios,
      retencion: tax,
      ppm: 0,
      pagoDesdeReceptor: totalHonorarios - tax,
      netoDespuesImpuesto: totalHonorarios - tax,
      montoAIngresarSii: totalHonorarios,
    };
  }

  return {
    issueYear,
    taxRateUsed,
    totalHonorarios,
    retencion: 0,
    ppm: tax,
    pagoDesdeReceptor: totalHonorarios,
    netoDespuesImpuesto: totalHonorarios - tax,
    montoAIngresarSii: totalHonorarios,
  };
}

function getInvoiceTaxSnapshot(invoice: Invoice, taxRates: TaxRate[]) {
  if (typeof invoice.totalHonorarios === "number") {
    return {
      issueYear: invoice.issueYear,
      taxRateUsed: invoice.taxRateUsed,
      totalHonorarios: invoice.totalHonorarios,
      retencion: invoice.retencion,
      ppm: invoice.ppm,
      pagoDesdeReceptor: invoice.pagoDesdeReceptor,
      netoDespuesImpuesto: invoice.netoDespuesImpuesto,
      montoAIngresarSii: invoice.montoAIngresarSii,
    };
  }

  const total = invoiceTotals(invoice).amount;
  return calculateTaxSnapshot(total, invoice.invoiceTaxType || "receptor_retiene", invoice.invoiceDate, taxRates);
}

function taxTypeLabel(type: InvoiceTaxType) {
  return type === "receptor_retiene" ? "Receptor retiene" : "Emisor paga PPM";
}

function overlapsRange(invoice: Invoice, from: string, to: string) {
  return invoice.entries.some((entry) => entry.startDate <= to && entry.endDate >= from);
}

function invoiceMatchesFilters(invoice: Invoice, filters: HistoryFilters) {
  if (filters.institution && invoice.institutionName !== filters.institution) return false;
  if (filters.taxType && (invoice.invoiceTaxType || "receptor_retiene") !== filters.taxType) return false;

  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom || filters.dateTo;
    const to = filters.dateTo || filters.dateFrom;
    const [rangeFrom, rangeTo] = sortDatePair(from, to);
    if (filters.dateTarget === "invoice") {
      if (invoice.invoiceDate < rangeFrom || invoice.invoiceDate > rangeTo) return false;
    } else if (!overlapsRange(invoice, rangeFrom, rangeTo)) {
      return false;
    }
  }

  return true;
}

function normalizeAmount(value: string) {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

function sortInvoicesNewestFirst(items: Invoice[]) {
  return [...items].sort((a, b) => {
    const byDate = b.invoiceDate.localeCompare(a.invoiceDate);
    return byDate || b.createdAt.localeCompare(a.createdAt);
  });
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("new");
  const [draft, setDraft] = useState<Draft>(createDraft);
  const [rates, setRates] = useState<SavedRate[]>(defaultRates);
  const [institutions, setInstitutions] = useState<Institution[]>(defaultInstitutions);
  const [taxRates, setTaxRates] = useState<TaxRate[]>(defaultTaxRates);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [toast, setToast] = useState("");
  const [periodModal, setPeriodModal] = useState<PeriodModal | null>(null);
  const [timeModal, setTimeModal] = useState<TimeModal | null>(null);
  const [rateModal, setRateModal] = useState<RateModal | null>(null);
  const [showInstitutionPicker, setShowInstitutionPicker] = useState(false);
  const [editingRate, setEditingRate] = useState<SavedRate | null>(null);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [showTaxRates, setShowTaxRates] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [saveNoticeOpen, setSaveNoticeOpen] = useState(false);
  const [entryDeleteConfirm, setEntryDeleteConfirm] = useState<{ entryId: string; label: string } | null>(null);
  const [invoiceDeleteConfirm, setInvoiceDeleteConfirm] = useState<Invoice | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>(null);
  const [exportRange, setExportRange] = useState({ from: today(), to: today() });
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [showEntryDetails, setShowEntryDetails] = useState(true);
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    institution: "",
    taxType: "",
    dateTarget: "invoice",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    setRates(normalizeRates(parseStored(STORAGE_KEYS.rates, defaultRates)));
    setInstitutions(normalizeInstitutions(parseStored(STORAGE_KEYS.institutions, defaultInstitutions)));
    setTaxRates(normalizeTaxRates(parseStored(STORAGE_KEYS.taxRates, defaultTaxRates)));
    setInvoices(parseStored(STORAGE_KEYS.invoices, []));
    setReady(true);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (ready) saveStored(STORAGE_KEYS.rates, rates);
  }, [rates, ready]);

  useEffect(() => {
    if (ready) saveStored(STORAGE_KEYS.institutions, institutions);
  }, [institutions, ready]);

  useEffect(() => {
    if (ready) saveStored(STORAGE_KEYS.taxRates, taxRates);
  }, [taxRates, ready]);

  useEffect(() => {
    if (ready) saveStored(STORAGE_KEYS.invoices, invoices);
  }, [invoices, ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totals = useMemo(() => invoiceTotals(draft), [draft]);
  const taxPreview = useMemo(
    () => calculateTaxSnapshot(totals.amount, draft.invoiceTaxType, draft.invoiceDate, taxRates),
    [draft.invoiceDate, draft.invoiceTaxType, taxRates, totals.amount],
  );
  const historyInstitutions = useMemo(
    () => Array.from(new Set(invoices.map((invoice) => invoice.institutionName))).filter(Boolean).sort(),
    [invoices],
  );
  const filteredInvoices = useMemo(
    () => invoices.filter((invoice) => invoiceMatchesFilters(invoice, historyFilters)),
    [historyFilters, invoices],
  );
  const activeFilterCount =
    (historyFilters.institution ? 1 : 0) +
    (historyFilters.taxType ? 1 : 0) +
    (historyFilters.dateFrom || historyFilters.dateTo ? 1 : 0);

  function updateEntry(entryId: string, patch: Partial<Entry>) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === entryId ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function addEntry() {
    setDraft((current) => ({ ...current, entries: [...current.entries, createEntry()] }));
  }

  function removeEntry(entryId: string) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.length === 1
        ? [createEntry()]
        : current.entries.filter((entry) => entry.id !== entryId),
    }));
  }

  function openPeriod(entry: Entry) {
    setPeriodModal({
      entryId: entry.id,
      startDate: entry.startDate,
      endDate: entry.endDate,
      hasEndDate: entry.startDate !== entry.endDate,
    });
  }

  function savePeriod() {
    if (!periodModal) return;
    const end = periodModal.hasEndDate ? periodModal.endDate : periodModal.startDate;
    if (!isValidDateString(periodModal.startDate) || !isValidDateString(end)) {
      setToast("Selecciona fechas válidas para el período.");
      return;
    }
    const [startDate, endDate] = sortDatePair(periodModal.startDate, end);
    const rangeDays = dateDiffInclusive(startDate, endDate);
    updateEntry(periodModal.entryId, {
      startDate,
      endDate,
      timeMode: rangeDays === 1 ? "single" : "perDay",
      daysCount: rangeDays,
    });
    setPeriodModal(null);
  }

  function openTime(entry: Entry) {
    setTimeModal({ ...entry, warnedOverDays: false });
  }

  function updateTimeModal(patch: Partial<TimeModal>) {
    setTimeModal((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      const rangeDays = dateDiffInclusive(next.startDate, next.endDate);
      if (next.timeMode === "perDay" && next.daysCount > rangeDays && !next.warnedOverDays) {
        setToast("Los días ingresados superan el rango seleccionado. Se mantendrá el valor marcado en rojo.");
        next.warnedOverDays = true;
      }
      return next;
    });
  }

  function saveTime() {
    if (!timeModal) return;
    updateEntry(timeModal.id, {
      timeMode: timeModal.timeMode,
      daysCount: Math.max(1, timeModal.daysCount),
      hours: Math.max(0, timeModal.hours),
      minutes: Math.max(0, timeModal.minutes),
      hoursPerDay: Math.max(0, timeModal.hoursPerDay),
      minutesPerDay: Math.max(0, timeModal.minutesPerDay),
    });
    setTimeModal(null);
  }

  function openRate(entry: Entry) {
    setRateModal({
      entryId: entry.id,
      name: entry.valueName,
      amount: entry.valueAmount ? String(entry.valueAmount) : "",
    });
  }

  function saveManualRate() {
    if (!rateModal) return;
    updateEntry(rateModal.entryId, {
      valueName: rateModal.name.trim(),
      valueAmount: normalizeAmount(rateModal.amount),
      valueSource: "manual",
    });
    setRateModal(null);
  }

  function chooseRate(rate: SavedRate) {
    if (!rateModal) return;
    updateEntry(rateModal.entryId, {
      valueName: rate.name,
      valueAmount: rate.amount,
      valueSource: "saved",
    });
    setRateModal(null);
  }

  function chooseInstitution(institution: Institution) {
    setDraft((current) => ({
      ...current,
      institutionName: institution.name,
      institutionSource: "saved",
      invoiceTaxType: institution.invoiceTaxType || "receptor_retiene",
    }));
    setShowInstitutionPicker(false);
  }

  function saveInvoice() {
    if (!draft.institutionName.trim()) {
      setToast("Agrega una institución antes de guardar.");
      return;
    }
    if (!isValidDateString(draft.invoiceDate)) {
      setToast("Selecciona una fecha válida para la boleta.");
      return;
    }
    if (draft.entries.some((entry) => !isValidDateString(entry.startDate) || !isValidDateString(entry.endDate))) {
      setToast("Cada línea debe tener una fecha o rango de fechas válido.");
      return;
    }
    if (draft.entries.some((entry) => entryMinutes(entry) <= 0)) {
      setToast("Cada línea debe tener horas/minutos mayores a 0.");
      return;
    }
    if (draft.entries.some((entry) => !entry.valueName.trim() || entry.valueAmount <= 0)) {
      setToast("Cada línea debe tener un valor hora con monto.");
      return;
    }

    const invoice: Invoice = {
      ...draft,
      ...taxPreview,
      id: uid(),
      createdAt: new Date().toISOString(),
      institutionName: draft.institutionName.trim(),
      entries: draft.entries.map((entry) => ({ ...entry })),
    };
    setInvoices((current) => [invoice, ...current]);
    setDraft(createDraft());
    setTab("history");
    setToast("Boleta guardada en historial.");
    setSaveNoticeOpen(true);
  }

  function duplicateInvoice(invoice: Invoice) {
    let hasManualRate = false;
    const entries = invoice.entries.map((entry) => {
      const match = rates.find(
        (rate) => rate.name === entry.valueName && rate.amount === entry.valueAmount,
      );
      if (!match) hasManualRate = true;
      return {
        ...entry,
        id: uid(),
        valueSource: match ? "saved" as ValueSource : "manual" as ValueSource,
      };
    });

    setDraft({
      institutionName: invoice.institutionName,
      institutionSource: institutions.some((item) => item.name === invoice.institutionName)
        ? "saved"
        : "manual",
      invoiceTaxType: invoice.invoiceTaxType || "receptor_retiene",
      entries,
      invoiceNumber: "",
      invoiceDate: today(),
      status: "Pendiente de emitir",
      gloss: invoice.gloss,
    });
    setViewInvoice(null);
    setTab("new");
    setToast(
      hasManualRate
        ? "Nueva boleta de honorarios creada. Algunos valores hora no coinciden con los guardados actuales y se cargaron como manuales."
        : "Boleta duplicada como nueva boleta de honorarios.",
    );
  }

  function updateInvoice(invoiceId: string, patch: Partial<Invoice>) {
    setInvoices((current) =>
      current.map((invoice) => invoice.id === invoiceId ? { ...invoice, ...patch } : invoice),
    );
    setViewInvoice((current) => current && current.id === invoiceId ? { ...current, ...patch } : current);
  }

  function saveRate() {
    if (!editingRate || !editingRate.name.trim() || editingRate.amount <= 0) {
      setToast("Completa nombre y monto del valor hora.");
      return;
    }
    setRates((current) => {
      const exists = current.some((rate) => rate.id === editingRate.id);
      return exists
        ? current.map((rate) => rate.id === editingRate.id ? editingRate : rate)
        : [...current, editingRate];
    });
    setEditingRate(null);
  }

  function saveInstitution() {
    if (!editingInstitution || !editingInstitution.name.trim()) {
      setToast("Completa el nombre de la institución.");
      return;
    }
    const institutionToSave = {
      ...editingInstitution,
      invoiceTaxType: editingInstitution.invoiceTaxType || "receptor_retiene",
    };
    setInstitutions((current) => {
      const exists = current.some((item) => item.id === institutionToSave.id);
      return exists
        ? current.map((item) => item.id === institutionToSave.id ? institutionToSave : item)
        : [...current, institutionToSave];
    });
    setEditingInstitution(null);
  }

  function rowsForExport(items: Invoice[]) {
    const summary = items.map((invoice) => {
      const invoiceTotal = invoiceTotals(invoice);
      const tax = getInvoiceTaxSnapshot(invoice, taxRates);
      return {
        ID: invoice.id,
        Institución: invoice.institutionName,
        "Tipo boleta": taxTypeLabel(invoice.invoiceTaxType || "receptor_retiene"),
        "Año emisión": tax.issueYear,
        "Tasa usada": tax.taxRateUsed,
        "Periodo desde": formatDate(invoiceTotal.from),
        "Periodo hasta": formatDate(invoiceTotal.to),
        "Número boleta": invoice.invoiceNumber,
        "Fecha boleta": formatDate(invoice.invoiceDate),
        Estado: invoice.status,
        Glosa: invoice.gloss,
        "Total horas": splitMinutes(invoiceTotal.totalMinutes).hours,
        "Total minutos": splitMinutes(invoiceTotal.totalMinutes).minutes,
        "Total honorarios bruto": tax.totalHonorarios,
        Retención: tax.retencion,
        PPM: tax.ppm,
        "Pago esperado desde institución": tax.pagoDesdeReceptor,
        "Neto después de impuesto": tax.netoDespuesImpuesto,
        "Monto a ingresar SII": tax.montoAIngresarSii,
      };
    });

    const detail = items.flatMap((invoice) =>
      invoice.entries.map((entry) => {
        const total = splitMinutes(entryMinutes(entry));
        return {
        "ID boleta": invoice.id,
          Institución: invoice.institutionName,
          Comentario: entry.comment || "",
          "Línea desde": formatDate(entry.startDate),
          "Línea hasta": formatDate(entry.endDate),
          "Modo cálculo": entry.timeMode === "perDay" ? "Por día" : "Total",
          "Días cálculo": entry.timeMode === "perDay" ? entry.daysCount : "",
          Horas: total.hours,
          Minutos: total.minutes,
          "Horas por día": entry.timeMode === "perDay" ? entry.hoursPerDay : "",
          "Minutos por día": entry.timeMode === "perDay" ? entry.minutesPerDay : "",
          "Tipo valor hora": entry.valueName,
          "Valor hora": entry.valueAmount,
          "Monto línea": entryAmount(entry),
        };
      }),
    );

    return { summary, detail };
  }

  async function buildWorkbook(items: Invoice[]) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const rows = rowsForExport(items);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.summary), "Resumen");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.detail), "Detalle");
    const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    return new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  async function exportInvoices(items: Invoice[], filename: string, share = false) {
    if (!items.length) {
      setToast("No hay boletas para exportar.");
      return;
    }
    const blob = await buildWorkbook(items);
    const file = new File([blob], filename, { type: blob.type });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title: string; text: string }) => Promise<void>;
    };

    if (share && nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({
        files: [file],
        title: "Detalle de boleta",
        text: "Detalle de horas extras para boleta de honorarios.",
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function runExport() {
    if (exportMode === "all") {
      void exportInvoices(invoices, `Gestor_boletas_honorarios_full_export_${today()}.xlsx`);
      setExportMode(null);
    }
    if (exportMode === "range") {
      if (!isValidDateString(exportRange.from) || !isValidDateString(exportRange.to)) {
        setToast("Selecciona un rango de fechas válido para exportar.");
        return;
      }
      const [from, to] = sortDatePair(exportRange.from, exportRange.to);
      void exportInvoices(
        invoices.filter((invoice) => overlapsRange(invoice, from, to)),
        `Gestor_boletas_honorarios_range_export_${from}_${to}.xlsx`,
      );
      setExportMode(null);
    }
    if (exportMode === "selected") {
      void exportInvoices(
        sortInvoicesNewestFirst(invoices).filter((invoice) => selectedInvoices.includes(invoice.id)),
        `Gestor_boletas_honorarios_selection_export_${today()}.xlsx`,
      );
      setExportMode(null);
    }
  }

  function applyHistoryFilters() {
    if (
      (historyFilters.dateFrom && !isValidDateString(historyFilters.dateFrom)) ||
      (historyFilters.dateTo && !isValidDateString(historyFilters.dateTo))
    ) {
      setToast("Selecciona un rango de fechas válido para filtrar.");
      return;
    }
    setShowHistoryFilters(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Horas extras</p>
          <h1>Gestor de boletas de honorarios</h1>
        </div>
        <button className="icon-button image-icon-button" aria-label="Abrir configuración" onClick={() => setTab("settings")}>
          <img src="/icono_configuracion.png" alt="" />
        </button>
      </header>

      <nav className="tabs" aria-label="Secciones">
        <button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>Nueva boleta</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Registro de boletas</button>
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}

      {tab === "new" && (
        <section className="workspace">
          <section className="panel invoice-head">
            <label className="institution-field">
              <span>Institución</span>
              <div className="split-input">
                <input
                  value={draft.institutionName}
                  placeholder="Nombre de institución"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      institutionName: event.target.value,
                      institutionSource: "manual",
                    }))
                  }
                />
                <button className="list-button" type="button" onClick={() => setShowInstitutionPicker(true)} aria-label="Ver instituciones guardadas">
                  <img src="/icono_lista.png" alt="" />
                </button>
              </div>
            </label>
            <label className="tax-type-field">
              <span>Tipo de boleta</span>
              <select
                value={draft.invoiceTaxType}
                onChange={(event) => setDraft((current) => ({ ...current, invoiceTaxType: event.target.value as InvoiceTaxType }))}
              >
                <option value="receptor_retiene">Receptor retiene</option>
                <option value="emisor_paga_ppm">Emisor paga PPM</option>
              </select>
            </label>
            <label className={draft.status === "Pendiente de emitir" ? "invoice-date-field compact-row-field" : "invoice-date-field"}>
              <span>{draft.status === "Pendiente de emitir" ? "Fecha estimada emisión" : "Fecha emisión"}</span>
              <input
                type="date"
                value={draft.invoiceDate}
                onChange={(event) => setDraft((current) => ({ ...current, invoiceDate: event.target.value }))}
              />
            </label>
            <label className={draft.status === "Pendiente de emitir" ? "invoice-status-field compact-row-field" : "invoice-status-field"}>
              <span>Estado</span>
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as InvoiceStatus }))}
              >
                {STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            {draft.status !== "Pendiente de emitir" && (
              <label className="invoice-number-field">
                <span>Número boleta</span>
                <input
                  aria-label="Número boleta"
                  value={draft.invoiceNumber}
                  placeholder="Pendiente"
                  onChange={(event) => setDraft((current) => ({ ...current, invoiceNumber: event.target.value }))}
                />
              </label>
            )}
            <label className="gloss-field">
              <span>Glosa</span>
              <textarea
                rows={2}
                value={draft.gloss}
                placeholder="Texto libre para describir el servicio o detalle de la boleta"
                onChange={(event) => setDraft((current) => ({ ...current, gloss: event.target.value }))}
              />
            </label>
          </section>

          <section className="data-table">
            <div className="table-title">
              <h2>Líneas de cálculo</h2>
              <button className="secondary compact-toggle" onClick={() => setShowEntryDetails((current) => !current)}>
                {showEntryDetails ? "Ocultar detalle" : "Mostrar detalle"}
              </button>
            </div>
            {showEntryDetails && draft.entries.map((entry, index) => {
              const minutes = entryMinutes(entry);
              const perDayMinutes = entry.hoursPerDay * 60 + entry.minutesPerDay;
              return (
                <article className="entry-card" key={entry.id}>
                  <div className="entry-index">Línea {index + 1}</div>
                  <button className="field-button" onClick={() => openPeriod(entry)}>
                    <span>{entry.startDate === entry.endDate ? "Fecha" : "Rango de fechas"}</span>
                    <strong>
                      {formatDate(entry.startDate)}
                      {entry.startDate !== entry.endDate ? ` - ${formatDate(entry.endDate)}` : ""}
                    </strong>
                  </button>
                  <button className={`field-button ${minutes === 0 ? "needs-attention" : ""}`} onClick={() => openTime(entry)}>
                    <span>Horas / minutos</span>
                    <strong>{formatHours(minutes)}</strong>
                    <small>
                      {entry.timeMode === "perDay"
                        ? `${entry.daysCount} días calculados · ${formatHours(perDayMinutes)} por día`
                        : "Total ingresado"}
                    </small>
                  </button>
                  <button className={`field-button rate-field ${entry.valueAmount <= 0 ? "needs-attention" : ""}`} onClick={() => openRate(entry)}>
                    <span>Valor hora</span>
                    <strong>{entry.valueName || "Sin nombre"}</strong>
                    <small>{formatMoney(entry.valueAmount)}</small>
                  </button>
                  <div className="line-total">
                    <span>Monto línea</span>
                    <strong>{formatMoney(entryAmount(entry))}</strong>
                  </div>
                  <button
                    className="delete-line"
                    onClick={() => setEntryDeleteConfirm({ entryId: entry.id, label: `línea ${index + 1}` })}
                    aria-label={`Eliminar línea ${index + 1}`}
                  >
                    <img src="/icono_borrar.png" alt="" />
                  </button>
                  <label className="line-comment">
                    <span>Comentario</span>
                    <textarea
                      rows={1}
                      value={entry.comment || ""}
                      placeholder="Referencia opcional para esta línea"
                      onChange={(event) => updateEntry(entry.id, { comment: event.target.value })}
                    />
                  </label>
                </article>
              );
            })}
            {showEntryDetails && <div className="add-line-row">
              <button className="add-line-button" onClick={addEntry} aria-label="Agregar línea">
                <img src="/icono_agregar.png" alt="" />
              </button>
            </div>}
          </section>

          <section className="panel totals-panel">
            <div className="totals-group">
              <div>
                <span>Rango de fechas</span>
                <strong>{totals.from ? `${formatDate(totals.from)} - ${formatDate(totals.to)}` : "-"}</strong>
              </div>
              <div>
                <span>Total tiempo</span>
                <strong>{formatHours(totals.totalMinutes)}</strong>
              </div>
              <div>
                <span className="stacked-label">
                  Total honorarios bruto
                  <small>Monto a ingresar en SII</small>
                </span>
                <strong>{formatMoney(taxPreview.totalHonorarios)}</strong>
              </div>
            </div>
            <div className="totals-group tax-group">
              <div>
                <span>{draft.invoiceTaxType === "receptor_retiene" ? "Retención" : "PPM"} ({taxPreview.taxRateUsed}%)</span>
                <strong>{formatMoney(draft.invoiceTaxType === "receptor_retiene" ? taxPreview.retencion : taxPreview.ppm)}</strong>
              </div>
              <div>
                <span>Neto después de impuesto</span>
                <strong>{formatMoney(taxPreview.netoDespuesImpuesto)}</strong>
              </div>
              <div>
                <span>Pago esperado desde institución</span>
                <strong>{formatMoney(taxPreview.pagoDesdeReceptor)}</strong>
              </div>
            </div>
          </section>

          <div className="action-row">
            <button className="primary" onClick={saveInvoice}>Guardar registro</button>
            <button className="secondary" onClick={() => setClearConfirm(true)}>Limpiar</button>
          </div>
        </section>
      )}

      {tab === "history" && (
        <section className="workspace">
          <section className="history-toolbar panel">
            <div>
              <span>Boletas visibles</span>
              <strong>{filteredInvoices.length} de {invoices.length}</strong>
            </div>
            <div className="history-actions">
              <button className="secondary export-action" onClick={() => setShowExportMenu(true)}>Exportar</button>
              <button className="secondary filter-action" onClick={() => setShowHistoryFilters(true)}>
                Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </button>
            </div>
          </section>

          <section className="history-list">
            {invoices.length === 0 && <p className="empty">Aún no hay boletas guardadas.</p>}
            {invoices.length > 0 && filteredInvoices.length === 0 && <p className="empty">No hay boletas que coincidan con los filtros.</p>}
            {filteredInvoices.length > 0 && (
              <div className="history-table-header" aria-hidden="true">
                <span>Estado</span>
                <span>Institución</span>
                <span>Fecha boleta</span>
                <span>Período detalle</span>
                <span>Tipo boleta</span>
                <span>N° boleta</span>
                <span>Monto</span>
              </div>
            )}
            {filteredInvoices.map((invoice) => {
              const item = invoiceTotals(invoice);
              return (
                <button className="history-item" key={invoice.id} onClick={() => setViewInvoice(invoice)}>
                  <span className="history-cell" data-label="Estado">
                    <span className={`status ${invoice.status === "Boleta pagada" ? "paid" : ""}`}>{invoice.status}</span>
                  </span>
                  <strong className="history-cell" data-label="Institución">{invoice.institutionName}</strong>
                  <span className="history-cell" data-label="Fecha boleta">{formatDate(invoice.invoiceDate)}</span>
                  <span className="history-cell" data-label="Período detalle">{formatDate(item.from)} - {formatDate(item.to)}</span>
                  <span className="history-cell" data-label="Tipo boleta">{taxTypeLabel(invoice.invoiceTaxType || "receptor_retiene")}</span>
                  <span className="history-cell" data-label="N° boleta">{invoice.invoiceNumber || "Pendiente"}</span>
                  <b className="history-cell" data-label="Monto">{formatMoney(item.amount)}</b>
                </button>
              );
            })}
          </section>
        </section>
      )}

      {tab === "settings" && (
        <section className="workspace">
          <section className="panel settings-block">
            <div className="table-title">
              <h2>Valores hora</h2>
              <button className="icon-text-button" onClick={() => setEditingRate({ id: uid(), name: "", amount: 0 })}>
                <img src="/icono_agregar.png" alt="" />
                <span>Agregar</span>
              </button>
            </div>
            {rates.map((rate) => (
              <div className="list-row" key={rate.id}>
                <div>
                  <strong>{rate.name}</strong>
                  <span>{formatMoney(rate.amount)}</span>
                </div>
                <button className="action-icon" onClick={() => setEditingRate(rate)} aria-label={`Editar ${rate.name}`}>
                  <img src="/icono_editar.png" alt="" />
                </button>
                <button className="action-icon danger" onClick={() => setRates((current) => current.filter((item) => item.id !== rate.id))} aria-label={`Eliminar ${rate.name}`}>
                  <img src="/icono_borrar.png" alt="" />
                </button>
              </div>
            ))}
          </section>

          <section className="panel settings-block">
            <div className="table-title">
              <h2>Instituciones</h2>
              <button className="icon-text-button" onClick={() => setEditingInstitution({ id: uid(), name: "", invoiceTaxType: "receptor_retiene" })}>
                <img src="/icono_agregar.png" alt="" />
                <span>Agregar</span>
              </button>
            </div>
            {institutions.map((institution) => (
              <div className="list-row" key={institution.id}>
                <div>
                  <strong>{institution.name}</strong>
                  <span>{taxTypeLabel(institution.invoiceTaxType || "receptor_retiene")}</span>
                </div>
                <button className="action-icon" onClick={() => setEditingInstitution(institution)} aria-label={`Editar ${institution.name}`}>
                  <img src="/icono_editar.png" alt="" />
                </button>
                <button className="action-icon danger" onClick={() => setInstitutions((current) => current.filter((item) => item.id !== institution.id))} aria-label={`Eliminar ${institution.name}`}>
                  <img src="/icono_borrar.png" alt="" />
                </button>
              </div>
            ))}
          </section>

          <section className="panel export-panel">
            <h2>Tasas</h2>
            <button onClick={() => { setTaxRates((current) => normalizeTaxRates(current)); setShowTaxRates(true); }}>Editar tasas</button>
          </section>

        </section>
      )}

      {periodModal && (
        <Modal title="Seleccionar período" onClose={() => setPeriodModal(null)}>
          <label>
            <span>Fecha inicial</span>
            <input
              type="date"
              value={periodModal.startDate}
              onChange={(event) => setPeriodModal({ ...periodModal, startDate: event.target.value })}
            />
          </label>
          {periodModal.hasEndDate && (
            <label>
              <span>Fecha final</span>
              <input
                type="date"
                value={periodModal.endDate}
                onChange={(event) => setPeriodModal({ ...periodModal, endDate: event.target.value })}
              />
            </label>
          )}
          <button
            className="secondary full"
            onClick={() => setPeriodModal({
              ...periodModal,
              hasEndDate: !periodModal.hasEndDate,
              endDate: periodModal.startDate,
            })}
          >
            {periodModal.hasEndDate ? "Dejar solo una fecha" : "Agregar fecha final"}
          </button>
          <div className="modal-actions">
            <button className="primary" onClick={savePeriod}>Aceptar</button>
            <button className="secondary" onClick={() => setPeriodModal(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {timeModal && (
        <Modal title="Ingresar horas y minutos" onClose={() => setTimeModal(null)}>
          {dateDiffInclusive(timeModal.startDate, timeModal.endDate) > 1 && (
            <div className="segmented">
              <button
                className={timeModal.timeMode === "perDay" ? "active" : ""}
                onClick={() => updateTimeModal({ timeMode: "perDay" })}
              >
                Por día
              </button>
              <button
                className={timeModal.timeMode !== "perDay" ? "active" : ""}
                onClick={() => updateTimeModal({ timeMode: "total" })}
              >
                Total
              </button>
            </div>
          )}

          {timeModal.timeMode === "perDay" ? (
            <>
              <NumberStepper
                label="Días del rango"
                value={timeModal.daysCount}
                danger={timeModal.daysCount > dateDiffInclusive(timeModal.startDate, timeModal.endDate)}
                onChange={(value) => updateTimeModal({ daysCount: value })}
              />
              <NumberStepper label="Horas por día" value={timeModal.hoursPerDay} onChange={(value) => updateTimeModal({ hoursPerDay: value })} />
              <NumberStepper label="Minutos por día" value={timeModal.minutesPerDay} quickStep={15} onChange={(value) => updateTimeModal({ minutesPerDay: value })} />
              <div className="calculated-total">
                Total calculado <strong>{formatHours(entryMinutes(timeModal))}</strong>
              </div>
            </>
          ) : (
            <>
              <NumberStepper label="Horas" value={timeModal.hours} onChange={(value) => updateTimeModal({ hours: value })} />
              <NumberStepper label="Minutos" value={timeModal.minutes} quickStep={15} onChange={(value) => updateTimeModal({ minutes: value })} />
            </>
          )}
          <div className="modal-actions">
            <button className="primary" onClick={saveTime}>Aceptar</button>
            <button className="secondary" onClick={() => setTimeModal(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {rateModal && (
        <Modal
          title="Valor hora"
          onClose={() => setRateModal(null)}
          headerAction={
            <button
              className="icon-button image-icon-button"
              onClick={() => {
                setRateModal(null);
                setTab("settings");
              }}
              aria-label="Ir a configuración de valores hora"
            >
              <img src="/icono_configuracion.png" alt="" />
            </button>
          }
        >
          <label>
            <span>Nombre manual</span>
            <input value={rateModal.name} onChange={(event) => setRateModal({ ...rateModal, name: event.target.value })} />
          </label>
          <label>
            <span>Monto manual</span>
            <input inputMode="numeric" value={rateModal.amount} onChange={(event) => setRateModal({ ...rateModal, amount: event.target.value })} />
          </label>
          <button className="primary full" onClick={saveManualRate}>Usar valor manual</button>
          <div className="picker-list">
            {rates.map((rate) => (
              <button key={rate.id} onClick={() => chooseRate(rate)}>
                <strong>{rate.name}</strong>
                <span>{formatMoney(rate.amount)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showInstitutionPicker && (
        <Modal
          title="Instituciones guardadas"
          onClose={() => setShowInstitutionPicker(false)}
          headerAction={
            <button
              className="icon-button image-icon-button"
              onClick={() => {
                setShowInstitutionPicker(false);
                setTab("settings");
              }}
              aria-label="Ir a configuración de instituciones"
            >
              <img src="/icono_configuracion.png" alt="" />
            </button>
          }
        >
          <div className="picker-list">
            {institutions.map((institution) => (
              <button key={institution.id} onClick={() => chooseInstitution(institution)}>
                <strong>{institution.name}</strong>
                <span>{taxTypeLabel(institution.invoiceTaxType || "receptor_retiene")}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {editingRate && (
        <Modal title="Editar valor hora" onClose={() => setEditingRate(null)}>
          <label>
            <span>Nombre</span>
            <input value={editingRate.name} onChange={(event) => setEditingRate({ ...editingRate, name: event.target.value })} />
          </label>
          <label>
            <span>Monto</span>
            <input
              inputMode="numeric"
              value={editingRate.amount || ""}
              onChange={(event) => setEditingRate({ ...editingRate, amount: normalizeAmount(event.target.value) })}
            />
          </label>
          <button className="primary full" onClick={saveRate}>Guardar</button>
        </Modal>
      )}

      {editingInstitution && (
        <Modal title="Editar institución" onClose={() => setEditingInstitution(null)}>
          <label>
            <span>Nombre</span>
            <input value={editingInstitution.name} onChange={(event) => setEditingInstitution({ ...editingInstitution, name: event.target.value })} />
          </label>
          <label>
            <span>Tipo de boleta por defecto</span>
            <select
              value={editingInstitution.invoiceTaxType || "receptor_retiene"}
              onChange={(event) => setEditingInstitution({ ...editingInstitution, invoiceTaxType: event.target.value as InvoiceTaxType })}
            >
              <option value="receptor_retiene">Receptor retiene</option>
              <option value="emisor_paga_ppm">Emisor paga PPM</option>
            </select>
          </label>
          <button className="primary full" onClick={saveInstitution}>Guardar</button>
        </Modal>
      )}

      {showTaxRates && (
        <Modal title="Tasas de retención/PPM" onClose={() => setShowTaxRates(false)} variant="compact">
          <div className="tax-rate-list">
            {taxRates.map((item) => (
              <label key={item.year} className="tax-rate-row">
                <span>{item.year}</span>
                <div className="tax-rate-input">
                  <input
                    inputMode="decimal"
                    value={String(item.rate).replace(".", ",")}
                    onChange={(event) => {
                      const raw = event.target.value.replace(",", ".");
                      const rate = Number(raw);
                      setTaxRates((current) =>
                        current.map((rateItem) =>
                          rateItem.year === item.year
                            ? { ...rateItem, rate: Number.isFinite(rate) ? rate : 0 }
                            : rateItem,
                        ),
                      );
                    }}
                  />
                  <strong>%</strong>
                </div>
              </label>
            ))}
          </div>
          <button className="primary full" onClick={() => setShowTaxRates(false)}>Guardar tasas</button>
        </Modal>
      )}

      {viewInvoice && (
        <InvoiceModal
          invoice={viewInvoice}
          taxRates={taxRates}
          onClose={() => setViewInvoice(null)}
          onChange={(patch) => updateInvoice(viewInvoice.id, patch)}
          onRequestDelete={() => setInvoiceDeleteConfirm(viewInvoice)}
          onSave={() => {
            setViewInvoice(null);
            setToast("Cambios guardados.");
          }}
          onDuplicate={() => duplicateInvoice(viewInvoice)}
          onShare={() => void exportInvoices([viewInvoice], `boleta-${viewInvoice.invoiceNumber || viewInvoice.id}.xlsx`, true)}
        />
      )}

      {showHistoryFilters && (
        <Modal title="Filtros historial" onClose={() => setShowHistoryFilters(false)}>
          <label>
            <span>Institución</span>
            <select
              value={historyFilters.institution}
              onChange={(event) => setHistoryFilters((current) => ({ ...current, institution: event.target.value }))}
            >
              <option value="">Todas</option>
              {historyInstitutions.map((institution) => (
                <option key={institution} value={institution}>{institution}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Tipo de boleta</span>
            <select
              value={historyFilters.taxType}
              onChange={(event) => setHistoryFilters((current) => ({ ...current, taxType: event.target.value as HistoryFilters["taxType"] }))}
            >
              <option value="">Todos</option>
              <option value="receptor_retiene">Receptor retiene</option>
              <option value="emisor_paga_ppm">Emisor paga PPM</option>
            </select>
          </label>
          <label>
            <span>Filtrar por fecha de</span>
            <div className="segmented">
              <button
                className={historyFilters.dateTarget === "invoice" ? "active" : ""}
                onClick={() => setHistoryFilters((current) => ({ ...current, dateTarget: "invoice" }))}
              >
                Boleta
              </button>
              <button
                className={historyFilters.dateTarget === "period" ? "active" : ""}
                onClick={() => setHistoryFilters((current) => ({ ...current, dateTarget: "period" }))}
              >
                Detalle
              </button>
            </div>
          </label>
          <div className="two-columns">
            <label>
              <span>Desde</span>
              <input
                type="date"
                value={historyFilters.dateFrom}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              />
            </label>
            <label>
              <span>Hasta</span>
              <input
                type="date"
                value={historyFilters.dateTo}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, dateTo: event.target.value }))}
              />
            </label>
          </div>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setHistoryFilters({ institution: "", taxType: "", dateTarget: "invoice", dateFrom: "", dateTo: "" })}>
              Limpiar filtros
            </button>
            <button className="primary" onClick={applyHistoryFilters}>Aplicar</button>
          </div>
        </Modal>
      )}

      {clearConfirm && (
        <Modal title="Limpiar boleta" onClose={() => setClearConfirm(false)}>
          <p>¿Desea borrar todo lo ingresado en la boleta actual?</p>
          <div className="modal-actions">
            <button className="danger solid icon-text-button" onClick={() => { setDraft(createDraft()); setClearConfirm(false); }}>
              <img src="/icono_borrar.png" alt="" />
              <span>Borrar todo</span>
            </button>
            <button className="secondary" onClick={() => setClearConfirm(false)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {saveNoticeOpen && (
        <Modal title="Aviso importante" onClose={() => setSaveNoticeOpen(false)} variant="compact" hideClose>
          <p>
            Esta herramienta no emite boletas de honorarios ante el Servicio de Impuestos Internos (SII).
            Su finalidad es facilitar el cálculo de los montos y llevar el seguimiento de cada boleta.
            La emisión oficial debe realizarse directamente a través del sitio del SII.
          </p>
          <button className="primary full" onClick={() => setSaveNoticeOpen(false)}>Entendido</button>
        </Modal>
      )}

      {entryDeleteConfirm && (
        <Modal title={`¿Desea borrar la ${entryDeleteConfirm.label}?`} onClose={() => setEntryDeleteConfirm(null)} variant="compact">
          <div className="modal-actions centered-actions">
            <button
              className="danger solid icon-text-button"
              onClick={() => {
                removeEntry(entryDeleteConfirm.entryId);
                setEntryDeleteConfirm(null);
              }}
            >
              <img src="/icono_borrar.png" alt="" />
              <span>Eliminar</span>
            </button>
            <button className="secondary" onClick={() => setEntryDeleteConfirm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {invoiceDeleteConfirm && (
        <Modal title="Eliminar boleta" onClose={() => setInvoiceDeleteConfirm(null)}>
          <p>¿Está seguro que desea eliminar esta boleta? Se borrará para siempre del historial.</p>
          <div className="modal-actions">
            <button
              className="danger solid icon-text-button"
              onClick={() => {
                setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceDeleteConfirm.id));
                setSelectedInvoices((current) => current.filter((id) => id !== invoiceDeleteConfirm.id));
                setViewInvoice(null);
                setInvoiceDeleteConfirm(null);
                setToast("Boleta eliminada del historial.");
              }}
            >
              <img src="/icono_borrar.png" alt="" />
              <span>Eliminar boleta</span>
            </button>
            <button className="secondary" onClick={() => setInvoiceDeleteConfirm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {showExportMenu && (
        <Modal title="Exportar" onClose={() => setShowExportMenu(false)} variant="compact">
          <div className="export-menu">
            <button
              className="secondary"
              onClick={() => {
                setShowExportMenu(false);
                void exportInvoices(invoices, `Gestor_boletas_honorarios_full_export_${today()}.xlsx`);
              }}
            >
              Exportar todo
            </button>
            <button
              className="secondary"
              onClick={() => {
                setShowExportMenu(false);
                setExportMode("range");
              }}
            >
              Exportar por rango
            </button>
            <button
              className="secondary"
              onClick={() => {
                setShowExportMenu(false);
                setExportMode("selected");
              }}
            >
              Exportar seleccionados
            </button>
          </div>
        </Modal>
      )}

      {exportMode && (
        <Modal title="Exportar Excel" onClose={() => setExportMode(null)} variant={exportMode === "selected" ? "wide" : "default"}>
          {exportMode === "range" && (
            <div className="two-columns">
              <label>
                <span>Desde</span>
                <input type="date" value={exportRange.from} onChange={(event) => setExportRange({ ...exportRange, from: event.target.value })} />
              </label>
              <label>
                <span>Hasta</span>
                <input type="date" value={exportRange.to} onChange={(event) => setExportRange({ ...exportRange, to: event.target.value })} />
              </label>
            </div>
          )}
          {exportMode === "selected" && (
            <div className="select-list export-selection-table">
              <div className="export-selection-header" aria-hidden="true">
                <span></span>
                <span>Fecha boleta</span>
                <span>Institución</span>
                <span>Estado</span>
                <span>Tipo boleta</span>
                <span>N° boleta</span>
                <span>Monto</span>
              </div>
              {sortInvoicesNewestFirst(invoices).map((invoice) => (
                <label key={invoice.id} className="check-row export-selection-row">
                  <input
                    type="checkbox"
                    checked={selectedInvoices.includes(invoice.id)}
                    onChange={(event) => setSelectedInvoices((current) =>
                      event.target.checked
                        ? [...current, invoice.id]
                        : current.filter((id) => id !== invoice.id),
                    )}
                  />
                  <span data-label="Fecha boleta">{formatDate(invoice.invoiceDate)}</span>
                  <span data-label="Institución">{invoice.institutionName}</span>
                  <span data-label="Estado">{invoice.status}</span>
                  <span data-label="Tipo boleta">{taxTypeLabel(invoice.invoiceTaxType || "receptor_retiene")}</span>
                  <span data-label="N° boleta">{invoice.invoiceNumber || "Pendiente"}</span>
                  <strong data-label="Monto">{formatMoney(invoiceTotals(invoice).amount)}</strong>
                </label>
              ))}
            </div>
          )}
          <button className="primary full" onClick={runExport}>Generar archivo</button>
        </Modal>
      )}
    </main>
  );
}

function Modal({
  title,
  children,
  onClose,
  headerAction,
  variant = "default",
  hideClose = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  headerAction?: React.ReactNode;
  variant?: "default" | "compact" | "wide";
  hideClose?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <section className={`modal ${variant === "compact" ? "compact-modal" : ""} ${variant === "wide" ? "wide-modal" : ""}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="modal-head-actions">
            {headerAction}
            {!hideClose && <button className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>}
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

function NumberStepper({
  label,
  value,
  danger,
  quickStep,
  onChange,
}: {
  label: string;
  value: number;
  danger?: boolean;
  quickStep?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className={`stepper ${quickStep ? "wide-stepper" : ""} ${danger ? "danger-value" : ""}`}>
      <span>{label}</span>
      <div>
        {quickStep && <button className="quick-step" onClick={() => onChange(Math.max(0, value - quickStep))}>-{quickStep}</button>}
        <button onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <input
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(normalizeAmount(event.target.value))}
        />
        <button onClick={() => onChange(value + 1)}>+</button>
        {quickStep && <button className="quick-step" onClick={() => onChange(value + quickStep)}>+{quickStep}</button>}
      </div>
    </div>
  );
}

function InvoiceModal({
  invoice,
  taxRates,
  onClose,
  onChange,
  onRequestDelete,
  onSave,
  onDuplicate,
  onShare,
}: {
  invoice: Invoice;
  taxRates: TaxRate[];
  onClose: () => void;
  onChange: (patch: Partial<Invoice>) => void;
  onRequestDelete: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onShare: () => void;
}) {
  const totals = invoiceTotals(invoice);
  const tax = getInvoiceTaxSnapshot(invoice, taxRates);
  return (
    <Modal
      title="Detalle boleta"
      onClose={onClose}
      headerAction={
        <button className="icon-button danger-icon-button" onClick={onRequestDelete} aria-label="Eliminar boleta">
          <img src="/icono_borrar.png" alt="" />
        </button>
      }
    >
      <div className="detail-head">
        <strong>{invoice.institutionName}</strong>
        <span>{formatDate(totals.from)} - {formatDate(totals.to)}</span>
        <span>{taxTypeLabel(invoice.invoiceTaxType || "receptor_retiene")} · Año {tax.issueYear} · {tax.taxRateUsed}%</span>
        <b>{formatMoney(tax.totalHonorarios)}</b>
      </div>
      <div className="tax-summary">
        <div>
          <span className="stacked-label">
            Total honorarios bruto
            <small>Monto a ingresar en SII</small>
          </span>
          <strong>{formatMoney(tax.totalHonorarios)}</strong>
        </div>
        <div>
          <span>{(invoice.invoiceTaxType || "receptor_retiene") === "receptor_retiene" ? "Retención" : "PPM"}</span>
          <strong>{formatMoney((invoice.invoiceTaxType || "receptor_retiene") === "receptor_retiene" ? tax.retencion : tax.ppm)}</strong>
        </div>
        <div>
          <span>Pago esperado desde institución</span>
          <strong>{formatMoney(tax.pagoDesdeReceptor)}</strong>
        </div>
        <div>
          <span>Neto después de impuesto</span>
          <strong>{formatMoney(tax.netoDespuesImpuesto)}</strong>
        </div>
      </div>
      <div className="two-columns">
        <label>
          <span>Número boleta</span>
          <input value={invoice.invoiceNumber} onChange={(event) => onChange({ invoiceNumber: event.target.value })} />
        </label>
        <label>
          <span>{invoice.status === "Pendiente de emitir" ? "Fecha estimada emisión" : "Fecha emisión"}</span>
          <input type="date" value={invoice.invoiceDate} onChange={(event) => onChange({ invoiceDate: event.target.value })} />
        </label>
      </div>
      <label>
        <span>Estado</span>
        <select value={invoice.status} onChange={(event) => onChange({ status: event.target.value as InvoiceStatus })}>
          {STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
      </label>
      <label>
        <span>Glosa</span>
        <textarea rows={3} value={invoice.gloss} onChange={(event) => onChange({ gloss: event.target.value })} />
      </label>
      <div className="detail-lines">
        {invoice.entries.map((entry, index) => (
          <div key={entry.id}>
            <strong>Línea {index + 1}: {entry.valueName}</strong>
            <span>{formatDate(entry.startDate)} - {formatDate(entry.endDate)}</span>
            <span>{formatHours(entryMinutes(entry))} · {formatMoney(entryAmount(entry))}</span>
            {entry.comment && <span>{entry.comment}</span>}
          </div>
        ))}
      </div>
      <div className="modal-actions stack">
        <button className="primary" onClick={onSave}>Guardar cambios</button>
        <button className="primary" onClick={onShare}>Compartir Excel</button>
        <button className="secondary" onClick={onDuplicate}>Duplicar como nueva boleta de honorarios</button>
      </div>
    </Modal>
  );
}

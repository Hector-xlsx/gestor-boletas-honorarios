"use client";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { STORAGE, initialData, localDate, addDays, minutes, amount, duration, totals, period, reconcile, validateData, uid, mergeBackup, calendarLanes, applyRate, preferredInstitution, normalizeName, normalizeRut, isRut, combineOpen, isUnpaid, splitHours, configuredRates, mondayOf, pendingPeriodCalendar } from "./turnos";
import { personalizedGreeting } from "./saludos";
import { prepareLegacyRecovery, readLegacyBrowser } from "./legacy-recovery";
import type { RecoveryPlan } from "./legacy-recovery";
import type { Data, Shift, Closing, TaxType, Rate, Rut } from "./turnos";
import VersionOne from "./version-1/calendar";
import { TRIAL_STORAGE, trialId, startTrial, readTrial, writeTrial, endTrial } from "./version-trial";
const money = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const label = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
const typeLabel = (t: TaxType) => t === "receptor_retiene" ? "Receptor retiene" : "Emisor paga PPM";
const ZERO_HOURLY = "¿Estás seguro de que deseas mantener en cero el valor hora del turno?";
function ActionIcon({ edit = false }: { edit?: boolean }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {edit ? <path d="M12 20H4v-4L16 4l4 4-12 12H4m10-14 4 4" /> : <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />}
  </svg>;
}
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [change, setChange] = useState<{ data: Data } | { id: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    function sync() {
      try {
        setSessionId(trialId(localStorage));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo leer la versión activa.");
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === TRIAL_STORAGE || event.key === null) sync();
    }
    sync();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function requestChange(next: NonNullable<typeof change>) {
    setError("");
    setChange(next);
  }

  function confirmChange() {
    if (!change) return;
    try {
      if ("data" in change) {
        const current = localStorage.getItem(STORAGE);
        setSessionId(startTrial(localStorage, current === null ? change.data : JSON.parse(current)));
      } else {
        endTrial(localStorage, change.id);
        setSessionId(null);
      }
      setChange(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar de versión.");
    }
  }

  const returning = change !== null && "id" in change;
  return <>
    {sessionId ? <VersionTwo key={sessionId} sessionId={sessionId} versionAction={
      <button onClick={() => requestChange({ id: sessionId })}>Volver a la versión 1</button>
    } /> : <VersionOne versionAction={data =>
      <button onClick={() => requestChange({ data })}>Pasar a la versión 2</button>
    } />}
    {!change && error && <p role="alert">{error}</p>}
    {change && <Dialog title={returning ? "¿Volver a la versión 1?" : "¿Pasar a la versión 2?"}
      onClose={() => { setChange(null); setError(""); }}>
      {returning ? <p>Recuperarás los datos que tenías antes de pasar a la versión 2. Se descartarán todos los cambios que hiciste en la versión 2, incluidos turnos, boletas y ajustes.</p> : <>
        <p>Pasarás a la versión de prueba con una copia de tus datos. En la versión 2, los tipos de turno se agrupan por tipo de boleta y tendrás que revisar los turnos abiertos antes de consolidarlos.</p>
        <p>Si vuelves a la versión 1, recuperarás tus datos tal como estaban antes del cambio y se descartará todo lo que hagas en la versión 2.</p>
      </>}
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button onClick={() => { setChange(null); setError(""); }}>Cancelar</button>
        <button className="primary" onClick={confirmChange}>{returning ? "Volver a la versión 1" : "Pasar a la versión 2"}</button>
      </div>
    </Dialog>}
  </>;
}

function VersionTwo({ sessionId, versionAction }: { sessionId: string; versionAction: React.ReactNode }) {
  const [data, setData] = useState<Data>(initialData), [ready, setReady] = useState(false), [error, setError] = useState("");
  const [tab, setActiveTab] = useState("calendar"), [view, setView] = useState("month"), [anchor, setAnchor] = useState(localDate);
  const tabScroll = useRef<Record<string, number>>({});
  const restoreTabScroll = useRef(false);
  function setTab(next: string) {
    if (tab === next) return;
    tabScroll.current[tab] = window.scrollY;
    restoreTabScroll.current = true;
    setActiveTab(next);
  }
  useLayoutEffect(() => {
    if (!restoreTabScroll.current) return;
    restoreTabScroll.current = false;
    window.scrollTo(0, tabScroll.current[tab] ?? 0);
  }, [tab]);
  const [showPendingPeriod, setShowPendingPeriod] = useState(true);
  const [advancedPending, setAdvancedPending] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [day, setDay] = useState<string | null>(null), [editor, setEditor] = useState<Shift | null>(null);
  const [confirmation, setConfirmation] = useState<{
    text: string;
    next: Data;
    closeEditor?: boolean;
  } | null>(null);
  const [institutionId, setInstitutionId] = useState(""), [range, setRange] = useState(() => period(localDate(), 16, 15));
  const [selected, setSelected] = useState<string[]>([]), [name, setName] = useState(""), [taxType, setTaxType] = useState<TaxType>("receptor_retiene");
  const [detail, setDetail] = useState<string | null>(null), [historyFilter, setHistoryFilter] = useState({ institution: "", from: "", to: "" });
  const [exportIds, setExportIds] = useState<string[]>([]), [imported, setImported] = useState<Data | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [legacyRecovery,setLegacyRecovery]=useState<{plan:RecoveryPlan;baseline:string|null;source:string}|null>(null);
  const [nameDialog,setNameDialog]=useState(false);
  const [rutDialog,setRutDialog]=useState(false);
  const [welcome,setWelcome]=useState<{name:string;message?:string}|null>(null);
  const welcomeRequest=useRef({id:0});
  const showWelcome=useCallback(async (profile:Pick<Data,"userName"|"userRut">)=>{
    const request=++welcomeRequest.current.id;
    const message=await personalizedGreeting(profile).catch(()=>undefined);
    if(request===welcomeRequest.current.id&&profile.userName)setWelcome({name:profile.userName,message});
  },[]);
  const [importMode, setImportMode] = useState<"all" | "deduplicate" | "replace">("deduplicate");
  useEffect(() => {
    const requests=welcomeRequest.current;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled)
        return;
      try {
        let next: Data = JSON.parse(readTrial(localStorage, sessionId));
        validateData(next);
        if(next.userName) next={...next,userName:normalizeName(next.userName)};
        if(next.userRut)next={...next,userRut:normalizeRut(next.userRut)};
        setData(next);
        setNameDialog(!next.userName);
        setRutDialog(!!next.userName&&!next.userRut);
        if(next.userName&&next.userRut)void showWelcome(next);
        setRange(period(localDate(), next.periodStart, next.periodEnd));
        setReady(true);
      }
      catch {
        setError("No se pudieron leer los datos locales. No se sobrescribirán. Recupera un respaldo desde Configuración.");
      }
    });
    if ("serviceWorker" in navigator && location.hostname !== "localhost" && location.hostname !== "127.0.0.1")
      navigator.serviceWorker.register("sw.js").catch(() => undefined);
    return () => { cancelled = true; requests.id++; };
  }, [sessionId, showWelcome]);
  useEffect(()=>{
    if(!welcome)return;
    const timer=window.setTimeout(()=>setWelcome(null),2000+Math.random()*1000);
    return ()=>window.clearTimeout(timer);
  },[welcome]);
  function commit(next: Data) {
    try {
      validateData(next);
      if(next.userName) next={...next,userName:normalizeName(next.userName)};
      if(next.userRut)next={...next,userRut:normalizeRut(next.userRut)};
      writeTrial(localStorage, sessionId, next);
      setData(next);
      setReady(true);
      setError("");
      return true;
    }
    catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los cambios.");
      return false;
    }
  }
  const assigned = new Set(data.closings.flatMap(c => c.shiftIds)), pending = data.shifts.filter(s => !assigned.has(s.id));
  const today = localDate();
  const currentMonthStart = today.slice(0, 7) + "-01";
  const previousMonthStart = addDays(currentMonthStart, -1).slice(0, 7) + "-01";
  const pendingCalendar = pendingPeriodCalendar(pending, data.closings, today, data.periodStart, data.periodEnd);
  const categories = data.institutions.filter(category => !category.archived);
  const rates = configuredRates(data);
  const needsReview = (s: Shift) => !assigned.has(s.id) && (!s.reviewed || !rates.some(r => r.id === s.rateId && r.categoryId === s.institutionId));
  const pendingReview = pending.filter(needsReview);
  const billable = pending.filter(s => !needsReview(s));
  const pendingTypes = data.rates.filter(r => !r.archived && !r.categoryId);
  const existingEditor = editor && data.shifts.find(s => s.id === editor.id);
  const closedEditor = !!editor && assigned.has(editor.id);
  const selectedRate = editor && rates.find(r => r.id === editor.rateId);
  const pendingHours = splitHours(pending);
  const shiftsOf = (c: Closing, source = data) => source.shifts.filter(s => c.shiftIds.includes(s.id));
  const eligible = billable.filter(s => s.institutionId === institutionId && s.start.slice(0, 10) >= range.from && s.start.slice(0, 10) <= range.to);
  const earlier = billable.filter(s => s.institutionId === institutionId && s.start.slice(0, 10) < range.from);
  const picked = [...eligible, ...earlier].filter(s => selected.includes(s.id));
  const taxYear = Number(localDate().slice(0, 4)), taxRate = data.taxRates.find(t => t.year === taxYear)?.rate, preview = totals(picked, taxType, taxRate ?? 0);
  const history = data.closings.filter(c => (!historyFilter.institution || c.institutionId === historyFilter.institution) && (!historyFilter.from || c.date >= historyFilter.from) && (!historyFilter.to || c.date <= historyFilter.to)).sort((a, b) => b.date.localeCompare(a.date));
  function chooseClosing(id: string, p = range, resetTax = true) {
    setInstitutionId(id);
    setRange(p);
    setSelected(billable.filter(s => s.institutionId === id && s.start.slice(0, 10) >= p.from && s.start.slice(0, 10) <= p.to).map(s => s.id));
    if (resetTax) setTaxType(data.institutions.find(i => i.id === id)?.invoiceTaxType ?? "receptor_retiene");
  }
  function startClosing() { const p = showPendingPeriod ? pendingCalendar.range : period(anchor, data.periodStart, data.periodEnd); chooseClosing(preferredInstitution(data), p); setName(`Boleta ${new Date(`${p.to}T12:00:00`).toLocaleDateString("es-CL", { month: "long", year: "numeric" })}`); setTab("closing"); }
  function newShift(date: string) { setEditor({ id: uid(), start: `${date}T08:00`, end: `${date}T09:00`, institutionId: "", rateId: "", rateName: "", amount: 0, noCharge: false, comment: "" }); }
  function saveShift() {
    if (!editor)
      return;
    const c = data.closings.find(c => c.shiftIds.includes(editor.id));
    if ((!c && !selectedRate?.categoryId) || !Number.isFinite(minutes(editor)) || minutes(editor) <= 0) {
      setError("Selecciona un tipo de turno configurado y un término posterior al inicio.");
      return;
    }
    const next = reconcile(data, c ? editor : { ...editor, institutionId: selectedRate!.categoryId!, reviewed: true });
    if (c) {
      const old = data.shifts.find(s => s.id === editor.id)!, before = totals(shiftsOf(c), c.taxType, c.taxRate), after = totals(shiftsOf(next.closings.find(n => n.id === c.id)!, next), c.taxType, c.taxRate), detached = !next.closings.find(n => n.id === c.id)!.shiftIds.includes(editor.id);
      const inst = (id: string) => data.institutions.find(i => i.id === id)?.name;
      setConfirmation({ next, closeEditor: true, text: `${editor.amount === 0 ? ZERO_HOURLY + "\n\n" : ""}¿Guardar cambios en el turno de «${c.name}»?\nInicio: ${old.start.replace("T", " ")} → ${editor.start.replace("T", " ")}\nTérmino: ${old.end.replace("T", " ")} → ${editor.end.replace("T", " ")}\nDuración: ${duration(minutes(old))} → ${duration(minutes(editor))}\nNombre turno: ${old.rateName} → ${editor.rateName}\nCategoría de boleta: ${inst(old.institutionId)} → ${inst(editor.institutionId)}\nComentario: ${old.comment || "—"} → ${editor.comment || "—"}\nMonto del turno: ${money(amount(old))} → ${money(amount(editor))}\nBruto de boleta: ${money(before.gross)} → ${money(after.gross)}\nImpuesto: ${money(before.tax)} → ${money(after.tax)}\nPago esperado: ${money(before.payment)} → ${money(after.payment)}${detached ? "\nEl turno se desvinculará de esta boleta." : next.closings.find(n => n.id === c.id)!.exceptions.includes(editor.id) ? "\nSe conserva su inclusión como excepción al período." : ""}` });
    }
    else if (editor.amount === 0)
      setConfirmation({ next, closeEditor: true, text: ZERO_HOURLY });
    else if (commit(next))
      setEditor(null);
  }
  function deleteShift(s: Shift) { const c = data.closings.find(c => c.shiftIds.includes(s.id)), next = reconcile(data, null, s.id); setConfirmation({ next, text: `¿Eliminar este turno de ${label(s.start.slice(0, 10))}?${c ? `\nAfecta «${c.name}»: bruto ${money(totals(shiftsOf(c), c.taxType, c.taxRate).gross)} → ${money(totals(shiftsOf(next.closings.find(n => n.id === c.id)!, next), c.taxType, c.taxRate).gross)}.` : ""}` }); }
  function consolidate() {
    const i = data.institutions.find(i => i.id === institutionId);
    if (!i || !name.trim() || !picked.length || !range.from || !range.to || range.from > range.to || taxRate === undefined) {
      setError("Completa nombre, categoría de boleta, período válido y al menos un turno. Configura la tasa del año actual.");
      return;
    }
    const c: Closing = { id: uid(), name: name.trim(), institutionId: i.id, institutionName: i.institutionName ?? "", categoryName: i.name, from: range.from, to: range.to, date: localDate(), taxType, taxRate, shiftIds: picked.map(s => s.id), exceptions: picked.filter(s => s.start.slice(0, 10) < range.from).map(s => s.id) };
    const hours = splitHours(picked);
    setConfirmation({ next: { ...data, closings: [...data.closings, c] }, text: `¿Consolidar «${c.name}»?\n${label(c.from)} al ${label(c.to)}\n${picked.length} turnos · Horas con cobro: ${duration(hours.paid)}${hours.unpaid ? `\nHoras sin cobro: ${duration(hours.unpaid)}` : ""}\nBruto: ${money(preview.gross)}\n${typeLabel(taxType)} (${taxRate}%): ${money(preview.tax)}\nPago esperado: ${money(preview.payment)}${c.exceptions.length ? `\nIncluye ${c.exceptions.length} turno(s) anterior(es) al período.` : ""}` });
  }
  async function exportExcel(items: Closing[], share = false) {
    try {
      if (!items.length) {
        setError("Selecciona al menos una boleta para exportar.");
        return;
      }
      const XLSX = await import("xlsx"), book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(items.map(c => { const shifts = shiftsOf(c), t = totals(shifts, c.taxType, c.taxRate), hours = splitHours(shifts); return { Nombre: c.name, "Categoría de boleta": c.categoryName ?? "", Institución: c.institutionName, Desde: c.from, Hasta: c.to, Consolidación: c.date, Modalidad: typeLabel(c.taxType), "Tasa %": c.taxRate, Horas: duration(t.minutes), "Horas con cobro": duration(hours.paid), "Horas sin cobro": duration(hours.unpaid), Bruto: t.gross, Impuesto: t.tax, "Pago esperado": t.payment, "Neto después de impuesto": t.net }; })), "Resumen");
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(items.flatMap(c => shiftsOf(c).map(s => ({ Boleta: c.name, "Categoría de boleta": c.categoryName ?? "", Institución: c.institutionName, Inicio: s.start, Término: s.end, Minutos: minutes(s), Tipo: s.rateName, "Valor hora": s.amount, Monto: amount(s), "Sin cobro": isUnpaid(s) ? "Sí" : "No", "Fuera del período": c.exceptions.includes(s.id) ? "Sí" : "No", Comentario: s.comment })))), "Detalle");
      const blob = new Blob([XLSX.write(book, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename = `Boletas_${localDate()}.xlsx`, file = new File([blob], filename, { type: blob.type });
      if (share && navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: items[0].name });
      else
        download(blob, filename);
    }
    catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError("No se pudo exportar o compartir el archivo.");
    }
  }
  async function readBackup(file: File) {
    try {
      const payload = JSON.parse(await file.text());
      if (payload.format !== "gestor-boletas-honorarios-backup" || ![2,3,4,5].includes(payload.version))
        throw new Error("Usa un respaldo del calendario versión 2, 3, 4 o 5. Para recuperar las boletas antiguas de este navegador, utiliza «Recuperar datos de la versión anterior».");
      validateData(payload.data);
      setImported(payload.data);
    }
    catch (e) {
      setError(e instanceof Error ? e.message : "Archivo inválido.");
    }
  }
  function recoverPreviousData() {
    try {
      const baseline=readTrial(localStorage, sessionId);
      const current:Data=baseline?JSON.parse(baseline):data;
      validateData(current);
      const source=readLegacyBrowser(localStorage);
      const plan=prepareLegacyRecovery(current,source);
      validateData(plan.next);
      setError("");
      setLegacyRecovery({plan,baseline,source:JSON.stringify(source)});
    } catch(e){setError(e instanceof Error?e.message:"No se pudieron revisar los datos anteriores.");}
  }
  const monthStart = anchor.slice(0, 7) + "-01";
  const weekStart = mondayOf(view === "month" ? monthStart : anchor);
  const dates = showPendingPeriod ? pendingCalendar.dates
    : Array.from({ length: view === "month" ? 42 : 7 }, (_, i) => addDays(weekStart, i));
  const dayShifts = (d: string) => data.shifts.filter(s => s.start.slice(0, 10) <= d && s.end > `${d}T00:00`).sort((a, b) => a.start.localeCompare(b.start));
  const currentClosing = data.closings.find(c => c.id === detail);
  function shiftActions(s: Shift) {
    return <div className="actions">
      <button className="icon-action" aria-label="Editar" title="Editar turno" onClick={() => setEditor({ ...s })}><ActionIcon edit /></button>
      <button className="danger icon-action" aria-label="Eliminar" title="Eliminar turno" onClick={() => deleteShift(s)}><ActionIcon /></button>
    </div>;
  }
  function shiftCard(s: Shift) {
    const c = data.closings.find(c => c.shiftIds.includes(s.id)); return <article className="shift-detail" key={s.id}>
      <strong>
        {s.rateName}
      </strong>
      <p>
        {s.start.replace("T", " ")} → {s.end.replace("T", " ")}
      </p>
      <p>
        {duration(minutes(s))} · {money(amount(s))} · {data.institutions.find(i => i.id === s.institutionId)?.name}
      </p>
      <small>
        {c ? `En ${c.name}` : needsReview(s) ? "⚠️ Pendiente de revisión" : "Sin boleta"}{isUnpaid(s) ? " · Sin cobro" : ""}{s.comment ? ` · ${s.comment}` : ""}{s.importedAmount?" · Monto recuperado con el redondeo original":""}
      </small>
      {shiftActions(s)}
    </article>;
  }
  function summary(shifts: Shift[], type: TaxType, rate: number) {
    const t = totals(shifts, type, rate), hours = splitHours(shifts);
    return <div className="live-totals">
      <div>Horas con cobro: {duration(hours.paid)}
        {hours.unpaid > 0 && <div>Horas sin cobro: {duration(hours.unpaid)}</div>}
      </div>
      <strong>Bruto {money(t.gross)}
      </strong>
      <span>
        {type === "receptor_retiene" ? "Retención" : "PPM"} ({rate}%): {money(t.tax)}
      </span>
      <strong>Pago esperado {money(t.payment)}
      </strong>
      <span>Neto después de impuesto: {money(t.net)}
      </span>
    </div>;
  }
  function selectRow(s: Shift, exception: boolean) {
    return <label className="turn-selection" key={s.id}>
      <input type="checkbox" checked={selected.includes(s.id)} onChange={e => setSelected(e.target.checked ? [...selected, s.id] : selected.filter(id => id !== s.id))} />
      <span>
        <strong>
          {label(s.start.slice(0, 10))} · {s.rateName}
        </strong>
        <small>
          {s.start.slice(11)} → {s.end.slice(0, 10) !== s.start.slice(0, 10) ? `${label(s.end.slice(0, 10))} ` : ""}{s.end.slice(11)} · {duration(minutes(s))}{exception ? " · Fuera del período" : ""}
        </small>
      </span>
      <strong>
        {isUnpaid(s) ? "Sin cobro" : money(amount(s))}
      </strong>
    </label>;
  }
  function move(direction: number) {
    if (view === "week") {
      setAnchor(addDays(anchor, direction * 7));
      return;
    }
    if (showPendingPeriod) {
      setShowPendingPeriod(false);
      setAnchor(direction < 0 ? previousMonthStart : currentMonthStart);
      return;
    }
    if ((direction < 0 && monthStart === currentMonthStart) ||
        (direction > 0 && monthStart === previousMonthStart)) {
      setShowPendingPeriod(true);
      return;
    }
    const month = new Date(`${monthStart}T12:00:00`);
    month.setMonth(month.getMonth() + direction);
    setAnchor(localDate(month));
  }
  // UI
  return <main className="calendar-app">
    <header className="calendar-header">
      <div>
        <span className="eyebrow">TU REGISTRO DE TRABAJO</span>

        <h1>Turnos y boletas</h1>
        <p>Registra tus turnos. Consolida cuando termine tu período.</p>
      </div>
      <button className="primary" disabled={!ready} onClick={startClosing}>Consolidar período</button>
    </header>
    <nav className="calendar-nav session-nav" aria-label="Secciones">
      {[["calendar", "Calendario"], ["pending", "Turnos sin boleta"], ["history", "Boletas"], ["settings", "Configuración"]].map(([key, text]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
        {text}
      </button>)}
    </nav>
    {error && <div role="alert" className="app-alert">
      {error}
      <button onClick={() => setError("")}>Cerrar aviso</button>
    </div>}
    {!ready && <p role="status">
      {error ? "Almacenamiento pendiente de recuperación." : "Cargando tus turnos…"}
    </p>}
    <section className="panel" hidden={tab !== "calendar"}>
      <div className="calendar-toolbar">
        <div className="actions">
          <button aria-label="Período anterior" onClick={() => move(-1)}>‹</button>
          <h2>
            {showPendingPeriod ? "Período actual" : new Date(`${anchor}T12:00:00`).toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
          </h2>
          <button aria-label="Período siguiente" onClick={() => move(1)}>›</button>
          <button onClick={() => { setShowPendingPeriod(false); setAnchor(localDate()); }}>Hoy</button>
        </div>
        <div className="actions">
          <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Mes</button>
          <button className={view === "week" ? "active" : ""} onClick={() => {
            if (showPendingPeriod) setAnchor(pendingCalendar.range.from);
            setShowPendingPeriod(false);
            setView("week");
          }}>Semana</button>
        </div>
      </div>
      {showPendingPeriod && <p className="muted">{label(pendingCalendar.range.from)} al {label(pendingCalendar.range.to)}</p>}
      <div className="calendar-scroll">
        <div className={`calendar-grid ${view}`}>
          <div className="weekdays">
            {dates.slice(0, 7).map(d => <button key={d} onClick={() => setDay(d)}>
              {new Date(`${d}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short" })}{view === "week" && ` ${Number(d.slice(8))}`}
            </button>)}
          </div>
          {view === "month" ? Array.from({ length: dates.length / 7 }, (_, row) => <div className="month-row" key={row}>
            <div className="month-days">
              {dates.slice(row * 7, row * 7 + 7).map(d => <button key={d} className={`${(showPendingPeriod ? d < pendingCalendar.range.from || d > pendingCalendar.range.to : d.slice(0, 7) !== anchor.slice(0, 7)) ? "outside" : ""} ${d === today ? "today" : ""}`} aria-label={`Ver turnos del ${label(d)}`} onClick={() => setDay(d)}>
                <span>
                  {Number(d.slice(8))}
                </span>
                <small>
                  {dayShifts(d).length ? `${dayShifts(d).length} turno(s)` : "+"}
                </small>
              </button>)}
            </div>
            <div className="month-events">
              {data.shifts.filter(s => s.start.slice(0, 10) <= dates[row * 7 + 6] && s.end > `${dates[row * 7]}T00:00`).sort((a, b) => a.start.localeCompare(b.start)).map(s => {
                const rowDates = dates.slice(row * 7, row * 7 + 7), occupied = rowDates.map((d, i) => s.start.slice(0, 10) <= d && s.end > `${d}T00:00` ? i : -1).filter(i => i >= 0); return <button key={s.id} className={`calendar-event ${isUnpaid(s) ? "free" : ""} ${assigned.has(s.id) ? "consolidated" : ""}`} style={{ gridColumn: `${occupied[0] + 1} / ${occupied[occupied.length - 1] + 2}` }} onClick={() => setDay(s.start.slice(0, 10) < rowDates[0] ? rowDates[0] : s.start.slice(0, 10))}>
                  {s.start.slice(0, 10) < rowDates[0] ? "← " : ""}{s.start.slice(11)} {needsReview(s) && "⚠️ "}{s.rateName}{s.end.slice(0, 10) > rowDates[6] ? " →" : ""}
                </button>;
              })}
            </div>
          </div>) : <div className="week-hours">
            <div className="hour-labels">
              {Array.from({ length: 24 }, (_, h) => <span key={h}>
                {String(h).padStart(2, "0")}:00</span>)}
            </div>
            {dates.map(d => <div className="week-day" key={d}>
              {Array.from({ length: 24 }, (_, h) => <button key={h} className="hour-slot" aria-label={`Ver ${label(d)}, ${h}:00`} onClick={() => setDay(d)} />)}{dayShifts(d).map(s => {
                const start = s.start.slice(0, 10) < d ? 0 : Number(s.start.slice(11, 13)) * 60 + Number(s.start.slice(14)), end = s.end.slice(0, 10) > d ? 1440 : Number(s.end.slice(11, 13)) * 60 + Number(s.end.slice(14)), layout = calendarLanes(dayShifts(d)).get(s.id)!; return <button key={s.id} className={`week-event ${isUnpaid(s) ? "free" : ""}`} style={{ top: start / 60 * 44, height: Math.max((end - start) / 60 * 44, 18), left: `${layout.lane / layout.columns * 100}%`, width: `${100 / layout.columns}%` }} onClick={() => setDay(d)}>
                  {s.start.slice(0, 10) < d ? "← " : ""}{needsReview(s) && "⚠️ "}{s.rateName}
                  <br />
                  {s.start.slice(11)}–{s.end.slice(11)}{s.end.slice(0, 10) > d ? " →" : ""}
                </button>;
              })}
            </div>)}
          </div>}
        </div>
      </div>
      <p className="muted">Toca un día para ver o agregar turnos. Gris: sin cobro. Las franjas continuas representan un solo turno.</p>
    </section>
    {tab === "pending" && <section className="panel">
      <div className="pending-heading">
        <h2>Turnos sin boleta</h2>
        <button type="button" aria-pressed={advancedPending} onClick={() => setAdvancedPending(!advancedPending)}>
          {advancedPending ? "Vista avanzada" : "Vista simple"}
        </button>
      </div>
      <p>Horas con cobro: <strong>{duration(pendingHours.paid)}</strong>
        {advancedPending && <> · {money(pending.reduce((n, s) => n + amount(s), 0))} bruto</>}
      </p>
      {pendingHours.unpaid > 0 && <p>Horas sin cobro: <strong>{duration(pendingHours.unpaid)}</strong></p>}
      {!pending.length && <p>Sin turnos pendientes.</p>}
      {data.rates.map(rate => {
        const list = pending.filter(s => s.rateId === rate.id).sort((a, b) => a.start.localeCompare(b.start));
        if (!list.length) return null;
        const hours = splitHours(list);
        return <details className="pending-institution" key={rate.id}>
          <summary><strong>{rate.name}</strong>
            <span>{list.length} {list.length === 1 ? "turno" : "turnos"} · {duration(hours.paid + hours.unpaid)}</span>
          </summary>
          {list.map(s => <article className="pending-shift" key={s.id}>
            <strong>{needsReview(s) && "⚠️ "}{s.rateName}</strong>
            <span>{label(s.start.slice(0, 10))} · {s.start.slice(11)}
              {advancedPending && <> → {s.end.slice(11)}{s.start.slice(0, 10) !== s.end.slice(0, 10) && (s.end.slice(0, 10) === addDays(s.start.slice(0, 10), 1) ? " (día siguiente)" : ` (${label(s.end.slice(0, 10))})`)}</>}
            </span>
            <span>{duration(minutes(s))}{isUnpaid(s) && " · Sin cobro"}</span>
            {advancedPending && <span>{money(amount(s))}</span>}
            {shiftActions(s)}
          </article>)}
        </details>;
      })}
    </section>}
    {tab === "closing" && <section className="panel closing-panel">
      <h2>Consolidar período</h2>
      <div className="form-grid">
        <label>Tipo de boleta<select value={institutionId} onChange={e => chooseClosing(e.target.value)}>
          <option value="">Selecciona tipo de boleta</option>
          {categories.map(i => <option key={i.id} value={i.id}>
            {i.name}
          </option>)}
        </select>
        </label>
        <label>Nombre de la boleta<input value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label>Desde<input type="date" value={range.from} onChange={e => chooseClosing(institutionId, { ...range, from: e.target.value }, false)} />
        </label>
        <label>Hasta<input type="date" value={range.to} onChange={e => chooseClosing(institutionId, { ...range, to: e.target.value }, false)} />
        </label>
      </div>
      {pendingReview.length > 0 && <details className="pending-institution" open>
        <summary>⚠️ Turnos pendientes de revisión ({pendingReview.length})</summary>
        <p>Revisa y guarda estos turnos antes de incluirlos en una boleta.</p>
        {pendingReview.map(shiftCard)}
      </details>}
      {institutionId && <>
        <h3>Turnos anteriores sin boleta ({earlier.length})</h3>
        <p className="muted">No están seleccionados. Puedes incluirlos como excepción al período.</p>
        {earlier.map(s => selectRow(s, true))}
        <h3>Turnos del período ({eligible.length})</h3>
        {eligible.map(s => selectRow(s, false))}{!eligible.length && <p>No hay turnos disponibles en este período.</p>}
        <label>Modalidad tributaria<select value={taxType} onChange={e => setTaxType(e.target.value as TaxType)}>
          <option value="receptor_retiene">Receptor retiene</option>
          <option value="emisor_paga_ppm">Emisor paga PPM</option>
        </select>
        </label>
        <p>Fecha de consolidación: {label(localDate())}
        </p>
        {taxRate === undefined && <p role="alert">Configura la tasa de {taxYear} antes de consolidar.</p>}{summary(picked, taxType, taxRate ?? 0)}
        <button className="primary" disabled={!ready || !picked.length || taxRate === undefined} onClick={consolidate}>Consolidar {picked.length} turno(s)</button>
      </>}
    </section>}
    {tab === "history" && <section className="panel">
      <h2>Boletas consolidadas</h2>
      <div className="form-grid">
        <label>Categoría de boleta<select value={historyFilter.institution} onChange={e => setHistoryFilter({ ...historyFilter, institution: e.target.value })}>
          <option value="">Todas</option>
          {data.institutions.map(i => <option key={i.id} value={i.id}>
            {i.name}
          </option>)}
        </select>
        </label>
        <label>Consolidación desde<input type="date" value={historyFilter.from} onChange={e => setHistoryFilter({ ...historyFilter, from: e.target.value })} />
        </label>
        <label>Consolidación hasta<input type="date" value={historyFilter.to} onChange={e => setHistoryFilter({ ...historyFilter, to: e.target.value })} />
        </label>
      </div>
      <div className="actions">
        <button onClick={() => void exportExcel(history)}>Exportar listado Excel</button>
        <button onClick={() => void exportExcel(history.filter(c => exportIds.includes(c.id)))}>Exportar selección</button>
      </div>
      {!history.length && <p>No hay boletas en este listado.</p>}{history.map(c => <article className="closing-card" key={c.id}>
        <label className="checkbox">
          <input type="checkbox" checked={exportIds.includes(c.id)} onChange={e => setExportIds(e.target.checked ? [...exportIds, c.id] : exportIds.filter(id => id !== c.id))} />Seleccionar para exportar</label>
        <h3>
          {c.name}
        </h3>
        <p>
          {[c.categoryName, c.institutionName].filter(Boolean).join(" · ")} · {label(c.from)} al {label(c.to)}
        </p>
        <p>Consolidada el {label(c.date)} · {c.shiftIds.length} turnos · {money(totals(shiftsOf(c), c.taxType, c.taxRate).gross)} bruto</p>
        <div className="actions">
          <button onClick={() => setDetail(c.id)}>Ver detalle</button>
          <button onClick={() => void exportExcel([c], true)}>Compartir / Excel</button>
          <button className="danger icon-action" aria-label="Eliminar" title="Eliminar boleta" onClick={() => setConfirmation({ next: { ...data, closings: data.closings.filter(n => n.id !== c.id) }, text: `¿Eliminar «${c.name}»? Sus turnos volverán a estar disponibles para consolidar.` })}><ActionIcon /></button>
        </div>
      </article>)}
    </section>}
    <div hidden={tab !== "settings"}>
      <Settings data={data} activePeriod={pendingCalendar.range} renderShift={shiftCard} ready={ready} commit={commit} confirm={setConfirmation} backup={() => download(new Blob([JSON.stringify({ format: "gestor-boletas-honorarios-backup", version: 5, createdAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" }), `Respaldo_turnos_${localDate()}.json`)} restore={() => fileRef.current?.click()} changeData={()=>setNameDialog(true)} recoverPrevious={recoverPreviousData} versionAction={versionAction} />
    </div>
    <input hidden ref={fileRef} type="file" accept=".json,application/json" onChange={e => {
      const file = e.target.files?.[0]; if (file)
        void readBackup(file); e.target.value = "";
    }} />
    {day && <Dialog title={label(day)} onClose={() => setDay(null)}>
      <button className="primary" disabled={!ready} onClick={() => newShift(day)}>+ Agregar turno</button>
      {dayShifts(day).length ? dayShifts(day).map(shiftCard) : <p>No hay turnos registrados en este día.</p>}
    </Dialog>}
    {editor && <Dialog title={data.shifts.some(s => s.id === editor.id) ? "Editar turno" : "Agregar turno"} onClose={() => setEditor(null)}>
      {error && <p role="alert">
        {error}
      </p>}
      <form onSubmit={e => { e.preventDefault(); saveShift(); }}>
        {closedEditor ? <p><strong>{editor.rateName}</strong> · {data.institutions.find(i => i.id === editor.institutionId)?.name}</p> : <>
          {existingEditor && needsReview(existingEditor) && <p className="schedule-note">⚠️ Pendiente de revisión. Selecciona un tipo de turno configurado y guarda para confirmar su tipo de boleta. Turno registrado: {existingEditor.rateName}.</p>}
          {!rates.length && <p className="schedule-note">Configura primero un tipo de turno dentro de un tipo de boleta en Configuración.</p>}
          <label>Nombre turno<select required value={selectedRate?.id ?? ""} onChange={e => {
            const rate = rates.find(r => r.id === e.target.value);
            if (!rate) return;
            const next = existingEditor ? { ...editor, rateId: rate.id, rateName: rate.name } : applyRate(editor, rate);
            setEditor({ ...next, institutionId: rate.categoryId! });
          }}>
            <option value="">Selecciona turno</option>
            {categories.map(category => <optgroup label={category.name} key={category.id}>
              {rates.filter(r => r.categoryId === category.id).map(r => <option key={r.id} value={r.id}>{r.name} · {money(r.amount)}/h</option>)}
            </optgroup>)}
          </select></label>
          {selectedRate && <p>Tipo de boleta: {categories.find(i => i.id === selectedRate.categoryId)?.name}</p>}
        </>}
        <div className="form-grid">
          <label>Fecha de inicio<input type="date" required value={editor.start.slice(0, 10)} onChange={e => setEditor({ ...editor, start: `${e.target.value}T${editor.start.slice(11)}` })} />
          </label>
          <label>Hora de inicio<input type="time" required value={editor.start.slice(11)} onChange={e => setEditor({ ...editor, start: `${editor.start.slice(0, 10)}T${e.target.value}` })} />
          </label>
          <label>Fecha de término<input type="date" required value={editor.end.slice(0, 10)} onChange={e => setEditor({ ...editor, end: `${e.target.value}T${editor.end.slice(11)}` })} />
          </label>
          <label>Hora de término<input type="time" required value={editor.end.slice(11)} onChange={e => setEditor({ ...editor, end: `${editor.end.slice(0, 10)}T${e.target.value}` })} />
          </label>
        </div>
        {editor.end.slice(0,10)>editor.start.slice(0,10)&&<p role="status" className="schedule-note">{editor.end.slice(0,10)===addDays(editor.start.slice(0,10),1)?"Atención: este turno termina al día siguiente.":`Atención: este turno termina el ${label(editor.end.slice(0,10))}.`}</p>}
        <p className="duration-preview" aria-live="polite">
          {minutes(editor) > 0 ? duration(minutes(editor)) : "El término debe ser posterior al inicio"}
        </p>
        {editor.rateId && <>
          <label>Valor hora<input type="number" min="0" step="any" required value={Number.isNaN(editor.amount) ? "" : editor.amount}
            onChange={e => setEditor({ ...editor, amount: e.target.valueAsNumber, noCharge: e.target.valueAsNumber === 0 })} /></label>
          <p>Total {money(Math.max(0, amount(editor)) || 0)}</p>
        </>}
        <label>Comentario opcional<textarea value={editor.comment} onChange={e => setEditor({ ...editor, comment: e.target.value })} />
        </label>
        <button className="primary" disabled={!ready || (!closedEditor && !selectedRate)}>Guardar turno</button>
      </form>
    </Dialog>}
    {currentClosing && <Dialog title={currentClosing.name} onClose={() => setDetail(null)}>
      <p>
        {[currentClosing.categoryName, currentClosing.institutionName].filter(Boolean).join(" · ")} · {label(currentClosing.from)} al {label(currentClosing.to)}
      </p>
      <p>Consolidación: {label(currentClosing.date)} · {typeLabel(currentClosing.taxType)}
      </p>
      {summary(shiftsOf(currentClosing), currentClosing.taxType, currentClosing.taxRate)}
      <form className="actions" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); commit({ ...data, closings: data.closings.map(c => c.id === currentClosing.id ? { ...c, name: String(f.get("name")).trim(), updatedAt: new Date().toISOString() } : c) }); }}>
        <input name="name" aria-label="Nombre de la boleta" defaultValue={currentClosing.name} required />
        <button>Renombrar</button>
      </form>
      {shiftsOf(currentClosing).map(s => <div key={s.id}>
        {currentClosing.exceptions.includes(s.id) && <p className="exception-note">Incluido fuera del período</p>}{shiftCard(s)}
      </div>)}
    </Dialog>}
    {confirmation && <Dialog title="Confirmar cambio" onClose={() => setConfirmation(null)}>
      {error && <p role="alert">
        {error}
      </p>}
      <p className="confirm-text">
        {confirmation.text}
      </p>
      <div className="actions">
        <button onClick={() => setConfirmation(null)}>Cancelar</button>
        <button className="primary" onClick={() => {
          if (commit(confirmation.next)) {
            if (confirmation.closeEditor)
              setEditor(null);
            if (confirmation.next.closings.length > data.closings.length)
              setTab("history");
            setConfirmation(null);
          }
        }}>Confirmar</button>
      </div>
    </Dialog>}
    {imported && <Dialog title="Recuperar respaldo" onClose={() => setImported(null)}>
      <p>El archivo contiene {imported.shifts.length} turnos, {imported.closings.length} boletas y {imported.institutions.length} instituciones.</p>
      <label>Modalidad<select value={importMode} onChange={e => setImportMode(e.target.value as "all" | "deduplicate" | "replace")}>
        <option value="deduplicate">Importar sin duplicados</option>
        <option value="all">Importar todo como copias nuevas</option>
        <option value="replace">Reemplazar todos los datos con el respaldo</option>
      </select>
      </label>
      <p>
        {importMode === "replace"
          ? `Se descartarán los ${data.shifts.length} turnos, las ${data.closings.length} boletas y la configuración actual de esta versión. Solo quedarán los datos del archivo. Descarga un respaldo primero si quieres conservar lo que tienes ahora.`
          : importMode === "all"
            ? "Agrega copias independientes de todos los turnos y boletas del archivo."
            : "Conserva los turnos y boletas actuales. Agrega los del archivo que tengan un ID nuevo. Dos registros iguales con IDs distintos se consideran diferentes."}
      </p>
      {error && <p role="alert">
        {error}
      </p>}
      <div className="actions">
        <button onClick={() => setImported(null)}>Cancelar</button>
        <button className="primary" onClick={() => {
          try {
            const next = importMode === "replace" ? imported : mergeBackup(data, imported, importMode);
            if (commit(next)) { setImported(null); setDay(null); setEditor(null); setDetail(null); setSelected([]); setExportIds([]); }
          } catch (e) { setError(e instanceof Error ? e.message : "No se pudo recuperar el respaldo."); }
        }}>Confirmar recuperación</button>
      </div>
    </Dialog>}
    {legacyRecovery&&<Dialog title="Recuperar datos de la versión anterior" onClose={()=>setLegacyRecovery(null)}>
      <p>Se encontraron {legacyRecovery.plan.found} boletas anteriores en este navegador. {legacyRecovery.plan.skipped} ya se habían recuperado.</p>
      <p>Los turnos comenzarán a las <strong>17:00</strong> y terminarán según sus horas y minutos guardados. Se agregarán al calendario y conservarán su boleta y montos. Tus registros actuales y los datos originales no se borrarán.</p>
      {!legacyRecovery.plan.found&&<p>No hay boletas anteriores disponibles aquí. Abre esta opción en el mismo dispositivo, navegador y dirección donde usabas la versión anterior. Los datos de la página publicada no están en localhost ni en otro navegador.</p>}
      {!!legacyRecovery.plan.rows.length&&<div className="calendar-scroll"><table className="recovery-table"><thead><tr><th>Boleta / institución</th><th>Período</th><th>Turnos</th><th>Tiempo</th><th>Bruto</th></tr></thead><tbody>
        {legacyRecovery.plan.rows.map((row,index)=><tr key={index}><td>{row.name}<br/><small>{row.institution}</small></td><td>{label(row.from)} al {label(row.to)}</td><td>{row.shifts}</td><td>{duration(row.minutes)}</td><td>{money(row.gross)}</td></tr>)}
      </tbody></table></div>}
      {legacyRecovery.plan.rows.flatMap((row,index)=>row.warnings.map((warning,j)=><p className="schedule-note" key={`${index}-${j}`}>{row.name}: {warning}</p>))}
      {!!legacyRecovery.plan.issues.length&&<div role="alert"><p>Estas boletas no se recuperarán porque requieren revisión. Sus datos originales siguen intactos:</p><ul>{legacyRecovery.plan.issues.map((issue,index)=><li key={index}>{issue}</li>)}</ul></div>}
      {error&&<p role="alert">{error}</p>}
      <div className="actions">
        <button onClick={()=>setLegacyRecovery(null)}>Cancelar</button>
        <button onClick={()=>download(new Blob([JSON.stringify({format:"gestor-boletas-honorarios-backup",version:5,createdAt:new Date().toISOString(),data},null,2)],{type:"application/json"}),`Respaldo_antes_recuperacion_${localDate()}.json`)}>Descargar respaldo actual</button>
        <button className="primary" disabled={!legacyRecovery.plan.rows.length} onClick={()=>{
          try {
            if(readTrial(localStorage, sessionId)!==legacyRecovery.baseline||JSON.stringify(readLegacyBrowser(localStorage))!==legacyRecovery.source){setError("Los datos cambiaron desde la vista previa. Cierra esta ventana y vuelve a revisar la recuperación antes de confirmar.");return;}
            if(commit(legacyRecovery.plan.next)){setLegacyRecovery(null);setTab("history");}
          }catch(e){setError(e instanceof Error?e.message:"No se pudo completar la recuperación.");}
        }}>Recuperar {legacyRecovery.plan.rows.length} boletas</button>
      </div>
    </Dialog>}
    {ready && !dismissedUpdate && !welcome && !nameDialog && !rutDialog && (pendingTypes.length > 0 || pendingReview.length > 0) &&
      <Dialog title="Actualizamos la aplicación" onClose={() => setDismissedUpdate(true)}>
        <p>Ahora cada tipo de turno pertenece a un tipo de boleta. Así puedes preparar distintas boletas en un mismo período, por ejemplo, «Turno Fijo» y «Apoyo».</p>
        <ol>
          <li>Crea los tipos de boleta que necesites en Configuración.</li>
          <li>Asigna los tipos de turno pendientes al grupo correspondiente.</li>
          <li>Revisa los turnos abiertos del calendario antes de consolidarlos.</li>
        </ol>
        <div className="actions">
          <button onClick={() => setDismissedUpdate(true)}>Entendido</button>
          <button className="primary" onClick={() => { setDismissedUpdate(true); setTab("settings"); }}>Ir a Configuración</button>
        </div>
      </Dialog>}
    {welcome&&<div className="welcome-message" role="status"><div className="welcome-content">{welcome.message?<p className="personalized-greeting">{welcome.message}</p>:<><p>Bienvenido de nuevo,</p><strong>{welcome.name}</strong></>}<span className="welcome-spinner" aria-hidden="true"/></div></div>}
    {nameDialog&&<NameDialog name={data.userName??""} onClose={()=>setNameDialog(false)} onSave={userName=>{if(commit({...data,userName})){setNameDialog(false);setRutDialog(true);return true;}return false;}}/>}
    {rutDialog&&<RutDialog rut={data.userRut} onClose={()=>{setRutDialog(false);if(data.userName)void showWelcome(data);}} onSave={userRut=>{if(commit({...data,userRut})){setRutDialog(false);if(data.userName)void showWelcome({...data,userRut});return true;}return false;}}/>}
  </main>;
}
function Dialog({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="turn-dialog" aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="dialog-heading">
      <h2>
        {title}
      </h2>
      <button aria-label="Cerrar" onClick={onClose}>×</button>
    </div>
    {children}
  </dialog>;
}
function Settings({ data, activePeriod, renderShift, ready, commit, confirm, backup, restore, changeData, recoverPrevious, versionAction }: {
  activePeriod: ReturnType<typeof period>;
  renderShift: (shift: Shift) => React.ReactNode;
  versionAction: React.ReactNode;
  data: Data;
  ready: boolean;
  commit: (next: Data) => boolean;
  confirm: (value: {
    text: string;
    next: Data;
  }) => void;
  backup: () => void;
  restore: () => void;
  changeData: () => void;
  recoverPrevious: () => void;
}) {
  const [overnightNotice, setOvernightNotice] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState<{ category?: Data["institutions"][number] } | null>(null);
  const [categoryError, setCategoryError] = useState("");
  const [rateEditor, setRateEditor] = useState<{ rate?: Rate; categoryId?: string } | null>(null);
  const [shiftList, setShiftList] = useState<{ categoryId: string; group: "current" | "closed" | "other" } | null>(null);
  const [combine, setCombine] = useState<{ kind: "rate" | "category"; source: string; target: string } | null>(null);
  const rates = data.rates.filter(rate => !rate.archived);
  const categories = data.institutions.filter(category => !category.archived);
  const sourceRate = rates.find(rate => rate.id === combine?.source);
  const catalog = combine?.kind === "rate" ? rates.filter(rate => rate.categoryId === sourceRate?.categoryId) : categories;
  const source = catalog.find(item => item.id === combine?.source);
  const target = catalog.find(item => item.id === combine?.target);
  const assigned = new Set(data.closings.flatMap(c => c.shiftIds));
  function shiftCounts(linked: Shift[]) {
    const groups = {
      current: { label: "Sin boleta en el período en curso", shifts: [] as Shift[] },
      closed: { label: "En boletas cerradas", shifts: [] as Shift[] },
      other: { label: "Sin boleta en otros períodos", shifts: [] as Shift[] },
    };
    for (const shift of linked) {
      const date = shift.start.slice(0, 10);
      const group = assigned.has(shift.id) ? groups.closed
        : activePeriod.from <= date && date <= activePeriod.to ? groups.current : groups.other;
      group.shifts.push(shift);
    }
    const shown = groups.other.shifts.length ? Object.values(groups) : [groups.current, groups.closed];
    return {
      groups,
      open: groups.current.shifts.length + groups.other.shifts.length,
      closed: groups.closed.shifts.length,
      text: shown.map(group => `${group.label}: ${group.shifts.length}`).join(" · "),
    };
  }
  const openCount = combine ? data.shifts.filter(shift => !assigned.has(shift.id) &&
    (combine.kind === "rate" ? shift.rateId : shift.institutionId) === combine.source).length : 0;
  function rateCard(rate: Rate) {
    const linkedShifts = data.shifts.filter(s => s.rateId === rate.id);
    const counts = shiftCounts(linkedShifts);
    const archive = counts.closed > 0;
    return <article className="rate-setting" key={rate.id}>
      <div className="rate-summary">
        <div>
          <strong>{rate.name}</strong>
          <p>{money(rate.amount)} por hora · {rate.defaultStart ?? "08:00"}–{rate.defaultEnd ?? "09:00"}</p>
        </div>
        <div className="actions">
          <button type="button" className="icon-action" aria-label={`Editar ${rate.name}`} title="Editar tipo de turno"
            disabled={!ready} onClick={() => setRateEditor({ rate, categoryId: rate.categoryId })}><ActionIcon edit /></button>
          {rates.some(r => r.id !== rate.id && r.categoryId === rate.categoryId) &&
            <button type="button" disabled={!ready} onClick={() => setCombine({ kind: "rate", source: rate.id, target: "" })}>Combinar</button>}
          <button type="button" className="danger icon-action" aria-label="Eliminar" title="Eliminar tipo de turno"
            disabled={!ready || counts.open > 0} onClick={() => confirm({
        next: { ...data, rates: archive
          ? data.rates.map(r => r.id === rate.id ? { ...r, archived: true } : r)
          : data.rates.filter(r => r.id !== rate.id) },
        text: (archive
          ? `¿Retirar «${rate.name}» de Configuración? Se archivará para conservar sus turnos y boletas en el historial.`
          : `¿Eliminar «${rate.name}»? Se quitará de Configuración.`) + `\n\n${counts.text}`,
      })}><ActionIcon /></button>
        </div>
      </div>
      <p className="muted">{counts.text}</p>
      {counts.open > 0 && <p className="muted">Revisa los turnos sin boleta antes de retirar este tipo.</p>}
    </article>;
  }
  return <section className="panel">
    <h2>Configuración</h2>
    {categoryEditor && <Dialog title={categoryEditor.category ? `Editar tipo de boleta · ${categoryEditor.category.name}` : "Crear nuevo tipo de boleta"} onClose={() => setCategoryEditor(null)}>
      {!categoryEditor.category && <p>Crea tantos tipos de boleta como boletas distintas debas emitir en un mismo período. Reutiliza cada tipo en los períodos siguientes.</p>}
      <form className="form-grid" onSubmit={e => {
        e.preventDefault();
        const fields = new FormData(e.currentTarget);
        const name = String(fields.get("name")).trim();
        if (!name) { setCategoryError("Ingresa un nombre para el tipo de boleta."); return; }
        const institutionName = String(fields.get("institution")).trim();
        const original = categoryEditor.category;
        const institutions: Data["institutions"] = original
          ? data.institutions.map(category => category.id === original.id
            ? { ...category, name, institutionName, invoiceTaxType: String(fields.get("type")) as TaxType }
            : category)
          : [...data.institutions, { id: uid(), name, institutionName, invoiceTaxType: "receptor_retiene" }];
        if (commit({ ...data, institutions })) {
          setCategoryEditor(null);
        } else setCategoryError("No se pudo guardar el tipo de boleta. Inténtalo nuevamente.");
      }}>
        <label>Nombre del tipo de boleta<input name="name" defaultValue={categoryEditor.category?.name ?? ""} required /></label>
        <label>Institución<input name="institution" defaultValue={categoryEditor.category?.institutionName ?? ""} /></label>
        {categoryEditor.category && <label>Modalidad tributaria<select name="type" defaultValue={categoryEditor.category.invoiceTaxType}>
          <option value="receptor_retiene">Receptor retiene</option>
          <option value="emisor_paga_ppm">Emisor paga PPM</option>
        </select></label>}
        {categoryError && <p role="alert">{categoryError}</p>}
        <div className="actions">
          <button type="button" onClick={() => setCategoryEditor(null)}>Cancelar</button>
          <button className="primary" disabled={!ready}>{categoryEditor.category ? "Guardar" : "Crear tipo de boleta"}</button>
        </div>
      </form>
    </Dialog>}
    {rateEditor && <Dialog title={rateEditor.rate ? `Editar ${rateEditor.rate.name}` : "Agregar tipo de turno"} onClose={() => setRateEditor(null)}>
      <RateForm rate={rateEditor.rate} categories={categories} fixedCategoryId={rateEditor.categoryId} ready={ready}
        onCancel={() => setRateEditor(null)}
        onOvernight={() => setOvernightNotice(true)}
        onSave={updated => {
          const nextRates = rateEditor.rate ? data.rates.map(rate => rate.id === updated.id ? updated : rate) : [...data.rates, updated];
          if (!commit({ ...data, rates: nextRates })) return false;
          setRateEditor(null);
          return true;
        }} />
    </Dialog>}
    {combine && source && <Dialog title={`Combinar «${source.name}»`} onClose={() => setCombine(null)}>
      <label>Combinar con<select value={combine.target} onChange={e => setCombine({ ...combine, target: e.target.value })}>
        <option value="">Selecciona el destino</option>
        {catalog.filter(item => item.id !== source.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <p>Turnos abiertos que cambiarán de clasificación: {openCount}. Se conservarán sus horarios, valores hora y montos.</p>
      {combine.kind === "category" && target && <p>
        Institución de destino: {categories.find(i => i.id === target.id)?.institutionName || "Sin especificar"} · {typeLabel(categories.find(i => i.id === target.id)!.invoiceTaxType)}
      </p>}
      <div className="actions">
        <button onClick={() => setCombine(null)}>Cancelar</button>
        <button className="primary" disabled={!target} onClick={() => {
          if (!target) return;
          confirm({ next: combineOpen(data, combine.kind, source.id, target.id),
            text: `¿Combinar «${source.name}» con «${target.name}»? Se reclasificarán ${openCount} turno(s) abierto(s) y «${source.name}» dejará de ofrecerse para turnos nuevos.` });
          setCombine(null);
        }}>Continuar</button>
      </div>
    </Dialog>}
    {overnightNotice && <Dialog title="Horario del turno" onClose={() => setOvernightNotice(false)}>
      <p>{OVERNIGHT_NOTICE}</p>
      <button className="primary" onClick={() => setOvernightNotice(false)}>Entendido</button>
    </Dialog>}
    <details className="settings-section">
    <summary>Período habitual</summary>
    <form className="form-grid" key={`${data.periodStart}-${data.periodEnd}`} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); commit({ ...data, periodStart: Number(f.get("start")), periodEnd: Number(f.get("end")) }); }}>
      <label>Día de inicio<input name="start" type="number" min="1" max="31" required defaultValue={data.periodStart} />
      </label>
      <label>Día de término<input name="end" type="number" min="1" max="31" required defaultValue={data.periodEnd} />
      </label>
      <button disabled={!ready}>Guardar período</button>
    </form>
    <p className="muted">Si el día final es menor al inicial, corresponde al mes siguiente. Los días inexistentes se ajustan al último día del mes.</p>
    </details>
    <details className="settings-section" open>
    <summary>Tipos de boleta</summary>
    <p className="muted">Período en curso del {label(activePeriod.from)} al {label(activePeriod.to)}.</p>
    <p>Crea un tipo por cada boleta distinta que emites en un mismo período. Si emites una por <strong>Turnos de apoyo</strong> y otra por <strong>Turnos fijos</strong>, configura esos dos tipos y reutilízalos en los períodos siguientes. Ambos pueden compartir institución.</p>
    <p>Dentro de cada tipo de boleta, puedes preparar tipos de turno como <strong>Normal</strong>, <strong>Feriado</strong> o <strong>Extra</strong>. Define su horario habitual y valor por hora una vez. Al registrar un turno en el calendario, esos datos se completan automáticamente y puedes ajustarlos para ese día.</p>
    <button type="button" disabled={!ready} onClick={() => { setCategoryError(""); setCategoryEditor({}); }}>Crear nuevo tipo de boleta</button>
    {categories.map(i => {
      const categoryRates = rates.filter(rate => rate.categoryId === i.id);
      const rateIds = new Set(categoryRates.map(rate => rate.id));
      const counts = shiftCounts(data.shifts.filter(shift =>
        shift.institutionId === i.id || (!assigned.has(shift.id) && rateIds.has(shift.rateId))));
      const archive = data.closings.some(c => c.institutionId === i.id);
      const pinned = preferredInstitution(data) === i.id;
      const selectedGroup = shiftList?.categoryId === i.id ? counts.groups[shiftList.group] : null;
      return <Fragment key={i.id}>
      <details className="pending-institution invoice-type-card">
      <summary>
        <strong>{i.name}</strong>
        <button type="button" className={`institution-pin ${pinned ? "pinned" : ""}`} aria-pressed={pinned}
          aria-label={`Usar ${i.name} como categoría predeterminada`} title={pinned ? "Tipo de boleta predeterminado" : "Marcar como predeterminado"}
          disabled={!ready} onClick={event => { event.preventDefault(); commit({ ...data, defaultInstitutionId: i.id }); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3h8l-1 7 4 4H5l4-4-1-7Z"/><path d="M12 14v8"/></svg>
        </button>
        <span className="shift-counts">
          {(["current", "closed", "other"] as const).map(key => {
            const group = counts.groups[key];
            return <button key={key} type="button" aria-haspopup="dialog" onClick={event => {
              event.preventDefault();
              setShiftList({ categoryId: i.id, group: key });
            }}>{group.label}: {group.shifts.length}</button>;
          })}
        </span>
      </summary>
      <div className="invoice-type-info">
      <p>{i.institutionName || "Institución sin especificar"} · {typeLabel(i.invoiceTaxType)}</p>
      <div className="actions">
      <button type="button" className="icon-action" aria-label={`Editar tipo de boleta ${i.name}`} title="Editar tipo de boleta"
        disabled={!ready} onClick={() => { setCategoryError(""); setCategoryEditor({ category: i }); }}><ActionIcon edit /></button>
      {categories.length > 1 && <button type="button" disabled={!ready} onClick={() => setCombine({ kind: "category", source: i.id, target: "" })}>Combinar</button>}
      <button type="button" className="danger icon-action" aria-label="Eliminar" title="Eliminar tipo de boleta" disabled={!ready || counts.open > 0} onClick={() => confirm({
        next: {
          ...data,
          institutions: archive
            ? data.institutions.map(n => n.id === i.id ? { ...n, archived: true } : n)
            : data.institutions.filter(n => n.id !== i.id),
          rates: data.rates.map(r => ({
            ...r,
            categoryId: r.categoryId === i.id ? undefined : r.categoryId,
            defaultCategoryId: r.defaultCategoryId === i.id ? undefined : r.defaultCategoryId,
          })),
          defaultInstitutionId: data.defaultInstitutionId === i.id ? undefined : data.defaultInstitutionId,
        },
        text: [
          archive ? `¿Retirar «${i.name}»? Se archivará para conservar sus boletas en el historial.`
            : `¿Eliminar «${i.name}»? Se quitará de Configuración.`,
          counts.text,
          categoryRates.length > 0 ? `Tipos de turno que volverán a Pendientes de configurar: ${categoryRates.length}.` : "",
        ].filter(Boolean).join("\n\n"),
      })}><ActionIcon /></button>
      </div>
      </div>
      <h4>Tipos de turno</h4>
      {categoryRates.map(rateCard)}
      <button type="button" disabled={!ready} onClick={() => setRateEditor({ categoryId: i.id })}>Agregar tipo de turno</button>
      </details>
      {selectedGroup && <Dialog title={`${i.name} · ${selectedGroup.label}`} onClose={() => setShiftList(null)}>
        {selectedGroup.shifts.length
          ? [...selectedGroup.shifts].sort((a, b) => a.start.localeCompare(b.start)).map(renderShift)
          : <p>No hay turnos en este grupo.</p>}
      </Dialog>}
      </Fragment>;
    })}
    {rates.some(rate => !rate.categoryId) && <section>
      <h3>⚠️ Tipos de turno pendientes de configurar</h3>
      {!categories.length && <p>Crea primero un tipo de boleta arriba para poder asignar estos turnos.</p>}
      {rates.filter(rate => !rate.categoryId).map(rateCard)}
    </section>}
    </details>
    <details className="settings-section tax-settings">
      <summary>Tasas anuales</summary>
      {data.taxRates.map(t => <form className="settings-row" key={`${t.year}-${t.rate}`} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); commit({ ...data, taxRates: data.taxRates.map(n => n.year === t.year ? { ...t, rate: Number(f.get("rate")) } : n) }); }}>
        <span>
          {t.year}
        </span>
        <label>Tasa %<input name="rate" type="number" min="0" max="100" step="0.01" required defaultValue={t.rate} />
        </label>
        <button disabled={!ready}>Guardar</button>
      </form>)}
      <form className="settings-row" onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.currentTarget), year = Number(f.get("year")); if (commit({ ...data, taxRates: [...data.taxRates.filter(t => t.year !== year), { year, rate: Number(f.get("rate")) }] }))
          e.currentTarget.reset();
      }}>
        <input name="year" aria-label="Año a configurar" type="number" min="2000" max="9999" placeholder="Año" required />
        <input name="rate" aria-label="Tasa porcentual" type="number" min="0" max="100" step="0.01" placeholder="Tasa %" required />
        <button disabled={!ready}>Guardar año</button>
      </form>
      <p className="muted">Cada boleta conserva la tasa del año de consolidación, incluso al corregir turnos.</p>
    </details>
    <details className="settings-section">
    <summary>Respaldo y recuperación</summary>
    <p>Incluye turnos, boletas y configuración. Puedes importar todo, importar sin duplicados o reemplazar, después de confirmar.</p>
    <div className="actions">
      <button disabled={!ready} onClick={backup}>Descargar respaldo</button>
      <button onClick={restore}>Recuperar respaldo</button>
      <button disabled={!ready} onClick={recoverPrevious}>Recuperar datos de la versión anterior</button>
    </div>
    </details>
    <details className="settings-section">
    <summary>Datos</summary>
    <div className="profile-details">
      <p><strong>Nombre:</strong> {data.userName??"Sin registrar"}</p>
      <p><strong>RUT:</strong> {data.userRut?`${data.userRut.number}-${data.userRut.verifier}`:"Sin registrar"}</p>
    </div>
    <button disabled={!ready} onClick={changeData}>Cambiar datos</button>
    </details>
    <div className="actions">{versionAction}</div>
  </section>;
}

const OVERNIGHT_NOTICE = "Atención: la hora de término es anterior a la hora de inicio. Se asumirá que el turno termina al día siguiente, después de las 00:00.";
function RateForm({ rate, categories = [], fixedCategoryId, ready, onSave, onCancel, onOvernight }: {
  rate?: Rate; categories?: Data["institutions"]; fixedCategoryId?: string; ready: boolean; onSave: (rate: Rate) => boolean;
  onCancel: () => void; onOvernight: () => void;
}) {
  const [start, setStart] = useState(rate?.defaultStart ?? "08:00");
  const [end, setEnd] = useState(rate?.defaultEnd ?? "09:00");
  const [error, setError] = useState("");
  const [confirmZero, setConfirmZero] = useState<Rate | null>(null);
  const overnight = end < start;
  function save(updated: Rate) {
    setConfirmZero(null);
    if (!onSave(updated)) { setError("No se pudo guardar el tipo de turno. Inténtalo nuevamente."); return; }
    if (overnight) onOvernight();
  }
  return <>
    {confirmZero && <Dialog title="Confirmar valor hora" onClose={() => setConfirmZero(null)}>
      <p>{ZERO_HOURLY}</p>
      <div className="actions">
        <button onClick={() => setConfirmZero(null)}>Cancelar</button>
        <button className="primary" onClick={() => save(confirmZero)}>Confirmar</button>
      </div>
    </Dialog>}
    <form className="rate-form" aria-label={rate ? `Configurar ${rate.name}` : "Agregar nombre turno"} onSubmit={e => {
      e.preventDefault();
      if (start === end) { setError("La hora de inicio y la hora de término deben ser diferentes."); return; }
      const fields = new FormData(e.currentTarget);
      const amount = Number(fields.get("amount"));
      const updated: Rate = { ...rate, id: rate?.id ?? uid(), name: String(fields.get("name")).trim(),
        amount, noCharge: amount === 0, defaultStart: start, defaultEnd: end,
        categoryId: fixedCategoryId ?? String(fields.get("category") ?? "") };
      if (!updated.categoryId) { setError("Selecciona un tipo de boleta."); return; }
      if (!updated.name) { setError("Ingresa un nombre de turno."); return; }
      if (amount === 0) setConfirmZero(updated);
      else save(updated);
    }}>
      <label>Nombre turno<input name="name" required defaultValue={rate?.name ?? ""} placeholder="Nombre del turno" />
      </label>
      <label>Valor hora<input name="amount" type="number" min="0" step="1" required defaultValue={rate?.amount ?? ""} />
      </label>
      <label>Hora inicio por defecto<input type="time" required value={start} onChange={e => setStart(e.target.value)} />
      </label>
      <label>Hora fin por defecto<input type="time" required value={end} onChange={e => setEnd(e.target.value)} />
      </label>
      {!fixedCategoryId && <label>Tipo de boleta<select name="category" required defaultValue="">
        <option value="">Selecciona tipo de boleta</option>
        {categories.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select></label>}
      <div className="actions">
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button className="primary" disabled={!ready || (!fixedCategoryId && !categories.length)}>{rate ? "Guardar" : "Agregar turno"}</button>
      </div>
    </form>
    {overnight && <p role="status" className="schedule-note">{OVERNIGHT_NOTICE}</p>}
    {error && <p role="alert">{error}</p>}
  </>;
}

function NameDialog({name,onClose,onSave}:{name:string;onClose:()=>void;onSave:(name:string)=>boolean}) {
  const [draft,setDraft]=useState(name);
  const [error,setError]=useState("");
  return <Dialog title={name?"Cambiar nombre":"Ingresa tu nombre"} onClose={onClose}>
    <form onSubmit={e=>{
      e.preventDefault();
      const trimmed=normalizeName(draft);
      if(!trimmed){setError("Ingresa tu nombre para guardar.");return;}
      if(!onSave(trimmed))setError("No se pudo guardar tu nombre. Inténtalo nuevamente.");
    }}>
      <label><input aria-label="Tu nombre" autoComplete="given-name" required maxLength={80} value={draft} onChange={e=>{setDraft(e.target.value);setError("");}}/></label>
      {error&&<p role="alert">{error}</p>}
      <button className="primary">Guardar nombre</button>
    </form>
  </Dialog>;
}

function RutDialog({rut,onClose,onSave}:{rut?:Rut;onClose:()=>void;onSave:(rut:Rut)=>boolean}) {
  const [number,setNumber]=useState(rut?.number??"");
  const [verifier,setVerifier]=useState(rut?.verifier??"");
  const [error,setError]=useState("");
  return <Dialog title="Ingresa tu RUT" onClose={onClose}>
    <form onSubmit={e=>{
      e.preventDefault();
      const value={number,verifier};
      if(!isRut(value)){setError("Ingresa un número de 7 u 8 dígitos y un verificador de 0 a 9 o K.");return;}
      if(!onSave(normalizeRut(value)))setError("No se pudo guardar tu RUT. Inténtalo nuevamente.");
    }}>
      <div className="rut-fields">
        <label>Número de RUT<input inputMode="numeric" autoComplete="off" required pattern="[0-9]{7,8}" minLength={7} maxLength={8} value={number} onChange={e=>{setNumber(e.target.value);setError("");}}/></label>
        <span aria-hidden="true">–</span>
        <label>Dígito verificador<input autoComplete="off" required pattern="[0-9kK]" maxLength={1} value={verifier} onChange={e=>{setVerifier(e.target.value.toUpperCase());setError("");}}/></label>
      </div>
      {error&&<p role="alert">{error}</p>}
      <button className="primary">Guardar RUT</button>
    </form>
  </Dialog>;
}

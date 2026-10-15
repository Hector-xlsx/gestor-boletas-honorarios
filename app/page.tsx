"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE, initialData, localDate, addDays, minutes, amount, duration, totals, period, reconcile, validateData, uid, mergeBackup, calendarLanes, applyRate, preferredInstitution, normalizeName, normalizeRut, isRut } from "./turnos";
import { personalizedGreeting } from "./saludos";
import type { Data, Shift, Closing, TaxType, Rate, Rut } from "./turnos";
const money = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const label = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
const typeLabel = (t: TaxType) => t === "receptor_retiene" ? "Receptor retiene" : "Emisor paga PPM";
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export default function Home() {
  const [data, setData] = useState<Data>(initialData), [ready, setReady] = useState(false), [error, setError] = useState("");
  const [tab, setTab] = useState("calendar"), [view, setView] = useState("month"), [anchor, setAnchor] = useState(localDate);
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
        const stored = localStorage.getItem(STORAGE);
        let next = initialData();
        if (stored) {
          next = JSON.parse(stored);
          validateData(next);
        }
        else {
          const rates = localStorage.getItem("cobro-horas-rates"), institutions = localStorage.getItem("cobro-horas-institutions"), taxes = localStorage.getItem("cobro-horas-tax-rates");
          if (rates)
            next.rates = [...JSON.parse(rates), next.rates.find(r => r.noCharge)!];
          if (institutions)
            next.institutions = JSON.parse(institutions);
          if (taxes)
            next.taxRates = JSON.parse(taxes);
          validateData(next);
        }
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
  }, [showWelcome]);
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
      localStorage.setItem(STORAGE, JSON.stringify(next));
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
  const assigned = new Set(data.closings.flatMap(c => c.shiftIds)), pending = data.shifts.filter(s => !s.noCharge && !assigned.has(s.id));
  const shiftsOf = (c: Closing, source = data) => source.shifts.filter(s => c.shiftIds.includes(s.id));
  const eligible = pending.filter(s => s.institutionId === institutionId && s.start.slice(0, 10) >= range.from && s.start.slice(0, 10) <= range.to);
  const earlier = pending.filter(s => s.institutionId === institutionId && s.start.slice(0, 10) < range.from);
  const picked = [...eligible, ...earlier].filter(s => selected.includes(s.id));
  const taxYear = Number(localDate().slice(0, 4)), taxRate = data.taxRates.find(t => t.year === taxYear)?.rate, preview = totals(picked, taxType, taxRate ?? 0);
  const history = data.closings.filter(c => (!historyFilter.institution || c.institutionId === historyFilter.institution) && (!historyFilter.from || c.date >= historyFilter.from) && (!historyFilter.to || c.date <= historyFilter.to)).sort((a, b) => b.date.localeCompare(a.date));
  function chooseClosing(id: string, p = range, resetTax = true) {
    setInstitutionId(id);
    setRange(p);
    setSelected(pending.filter(s => s.institutionId === id && s.start.slice(0, 10) >= p.from && s.start.slice(0, 10) <= p.to).map(s => s.id));
    if (resetTax) setTaxType(data.institutions.find(i => i.id === id)?.invoiceTaxType ?? "receptor_retiene");
  }
  function startClosing() { const p = period(anchor, data.periodStart, data.periodEnd); chooseClosing(preferredInstitution(data), p); setName(`Boleta ${new Date(`${p.to}T12:00:00`).toLocaleDateString("es-CL", { month: "long", year: "numeric" })}`); setTab("closing"); }
  function newShift(date: string) { setEditor({ id: uid(), start: `${date}T08:00`, end: `${date}T09:00`, institutionId: preferredInstitution(data), rateId: "", rateName: "", amount: 0, noCharge: false, comment: "" }); }
  function saveShift() {
    if (!editor)
      return;
    if (!editor.institutionId || !editor.rateId || !Number.isFinite(minutes(editor)) || minutes(editor) <= 0) {
      setError("Selecciona institución, tipo de turno y un término posterior al inicio.");
      return;
    }
    const next = reconcile(data, editor), c = data.closings.find(c => c.shiftIds.includes(editor.id));
    if (c) {
      const old = data.shifts.find(s => s.id === editor.id)!, before = totals(shiftsOf(c), c.taxType, c.taxRate), after = totals(shiftsOf(next.closings.find(n => n.id === c.id)!, next), c.taxType, c.taxRate), detached = !next.closings.find(n => n.id === c.id)!.shiftIds.includes(editor.id);
      const inst = (id: string) => data.institutions.find(i => i.id === id)?.name;
      setConfirmation({ next, closeEditor: true, text: `¿Guardar cambios en el turno de «${c.name}»?\nInicio: ${old.start.replace("T", " ")} → ${editor.start.replace("T", " ")}\nTérmino: ${old.end.replace("T", " ")} → ${editor.end.replace("T", " ")}\nDuración: ${duration(minutes(old))} → ${duration(minutes(editor))}\nNombre turno: ${old.rateName} → ${editor.rateName}\nInstitución: ${inst(old.institutionId)} → ${inst(editor.institutionId)}\nComentario: ${old.comment || "—"} → ${editor.comment || "—"}\nMonto del turno: ${money(amount(old))} → ${money(amount(editor))}\nBruto de boleta: ${money(before.gross)} → ${money(after.gross)}\nImpuesto: ${money(before.tax)} → ${money(after.tax)}\nPago esperado: ${money(before.payment)} → ${money(after.payment)}${detached ? "\nEl turno se desvinculará de esta boleta." : next.closings.find(n => n.id === c.id)!.exceptions.includes(editor.id) ? "\nSe conserva su inclusión como excepción al período." : ""}` });
    }
    else if (commit(next))
      setEditor(null);
  }
  function deleteShift(s: Shift) { const c = data.closings.find(c => c.shiftIds.includes(s.id)), next = reconcile(data, null, s.id); setConfirmation({ next, text: `¿Eliminar este turno de ${label(s.start.slice(0, 10))}?${c ? `\nAfecta «${c.name}»: bruto ${money(totals(shiftsOf(c), c.taxType, c.taxRate).gross)} → ${money(totals(shiftsOf(next.closings.find(n => n.id === c.id)!, next), c.taxType, c.taxRate).gross)}.` : ""}` }); }
  function consolidate() {
    const i = data.institutions.find(i => i.id === institutionId);
    if (!i || !name.trim() || !picked.length || !range.from || !range.to || range.from > range.to || taxRate === undefined) {
      setError("Completa nombre, institución, período válido y al menos un turno. Configura la tasa del año actual.");
      return;
    }
    const c: Closing = { id: uid(), name: name.trim(), institutionId: i.id, institutionName: i.name, from: range.from, to: range.to, date: localDate(), taxType, taxRate, shiftIds: picked.map(s => s.id), exceptions: picked.filter(s => s.start.slice(0, 10) < range.from).map(s => s.id) };
    setConfirmation({ next: { ...data, closings: [...data.closings, c] }, text: `¿Consolidar «${c.name}»?\n${label(c.from)} al ${label(c.to)}\n${picked.length} turnos · ${duration(preview.minutes)}\nBruto: ${money(preview.gross)}\n${typeLabel(taxType)} (${taxRate}%): ${money(preview.tax)}\nPago esperado: ${money(preview.payment)}${c.exceptions.length ? `\nIncluye ${c.exceptions.length} turno(s) anterior(es) al período.` : ""}` });
  }
  async function exportExcel(items: Closing[], share = false) {
    try {
      if (!items.length) {
        setError("Selecciona al menos una boleta para exportar.");
        return;
      }
      const XLSX = await import("xlsx"), book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(items.map(c => { const t = totals(shiftsOf(c), c.taxType, c.taxRate); return { Nombre: c.name, Institución: c.institutionName, Desde: c.from, Hasta: c.to, Consolidación: c.date, Modalidad: typeLabel(c.taxType), "Tasa %": c.taxRate, Horas: duration(t.minutes), Bruto: t.gross, Impuesto: t.tax, "Pago esperado": t.payment, "Neto después de impuesto": t.net }; })), "Resumen");
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(items.flatMap(c => shiftsOf(c).map(s => ({ Boleta: c.name, Institución: c.institutionName, Inicio: s.start, Término: s.end, Minutos: minutes(s), Tipo: s.rateName, "Valor hora": s.amount, Monto: amount(s), "Fuera del período": c.exceptions.includes(s.id) ? "Sí" : "No", Comentario: s.comment })))), "Detalle");
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
      if (payload.format !== "gestor-boletas-honorarios-backup" || payload.version !== 2)
        throw new Error("Usa un respaldo del calendario versión 2. Los registros anteriores no se migran.");
      validateData(payload.data);
      setImported(payload.data);
    }
    catch (e) {
      setError(e instanceof Error ? e.message : "Archivo inválido.");
    }
  }
  const monthStart = anchor.slice(0, 7) + "-01", base = view === "month" ? monthStart : anchor, weekStart = addDays(base, -((new Date(`${base}T12:00:00`).getDay() + 6) % 7));
  const dates = Array.from({ length: view === "month" ? 42 : 7 }, (_, i) => addDays(weekStart, i));
  const dayShifts = (d: string) => data.shifts.filter(s => s.start.slice(0, 10) <= d && s.end > `${d}T00:00`).sort((a, b) => a.start.localeCompare(b.start));
  const currentClosing = data.closings.find(c => c.id === detail);
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
        {c ? `En ${c.name}` : s.noCharge ? "Sin cobro" : "Sin boleta"}{s.comment ? ` · ${s.comment}` : ""}
      </small>
      <div className="actions">
        <button onClick={() => setEditor({ ...s })}>Editar</button>
        <button className="danger" onClick={() => deleteShift(s)}>Eliminar</button>
      </div>
    </article>;
  }
  function summary(t: ReturnType<typeof totals>, type: TaxType, rate: number) {
    return <div className="live-totals">
      <span>
        {duration(t.minutes)}
      </span>
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
        {money(amount(s))}
      </strong>
    </label>;
  }
  function move(direction: number) {
    const d = new Date(`${anchor}T12:00:00`); if (view === "month") {
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
    }
    else
      d.setDate(d.getDate() + direction * 7); setAnchor(localDate(d));
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
    <nav className="calendar-nav" aria-label="Secciones">
      {[["calendar", "Calendario"], ["pending", "Horas sin boleta"], ["history", "Boletas"], ["settings", "Configuración"]].map(([key, text]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
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
    {tab === "calendar" && <section className="panel">
      <div className="calendar-toolbar">
        <div className="actions">
          <button aria-label="Período anterior" onClick={() => move(-1)}>‹</button>
          <h2>
            {new Date(`${anchor}T12:00:00`).toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
          </h2>
          <button aria-label="Período siguiente" onClick={() => move(1)}>›</button>
          <button onClick={() => setAnchor(localDate())}>Hoy</button>
        </div>
        <div className="actions">
          <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Mes</button>
          <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Semana</button>
        </div>
      </div>
      <div className="calendar-scroll">
        <div className={`calendar-grid ${view}`}>
          <div className="weekdays">
            {dates.slice(0, 7).map(d => <button key={d} onClick={() => setDay(d)}>
              {new Date(`${d}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short" })}{view === "week" && ` ${Number(d.slice(8))}`}
            </button>)}
          </div>
          {view === "month" ? Array.from({ length: 6 }, (_, row) => <div className="month-row" key={row}>
            <div className="month-days">
              {dates.slice(row * 7, row * 7 + 7).map(d => <button key={d} className={`${d.slice(0, 7) !== anchor.slice(0, 7) ? "outside" : ""} ${d === localDate() ? "today" : ""}`} aria-label={`Ver turnos del ${label(d)}`} onClick={() => setDay(d)}>
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
                const rowDates = dates.slice(row * 7, row * 7 + 7), occupied = rowDates.map((d, i) => s.start.slice(0, 10) <= d && s.end > `${d}T00:00` ? i : -1).filter(i => i >= 0); return <button key={s.id} className={`calendar-event ${s.noCharge ? "free" : ""} ${assigned.has(s.id) ? "consolidated" : ""}`} style={{ gridColumn: `${occupied[0] + 1} / ${occupied[occupied.length - 1] + 2}` }} onClick={() => setDay(s.start.slice(0, 10) < rowDates[0] ? rowDates[0] : s.start.slice(0, 10))}>
                  {s.start.slice(0, 10) < rowDates[0] ? "← " : ""}{s.start.slice(11)} {s.rateName}{s.end.slice(0, 10) > rowDates[6] ? " →" : ""}
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
                const start = s.start.slice(0, 10) < d ? 0 : Number(s.start.slice(11, 13)) * 60 + Number(s.start.slice(14)), end = s.end.slice(0, 10) > d ? 1440 : Number(s.end.slice(11, 13)) * 60 + Number(s.end.slice(14)), layout = calendarLanes(dayShifts(d)).get(s.id)!; return <button key={s.id} className={`week-event ${s.noCharge ? "free" : ""}`} style={{ top: start / 60 * 44, height: Math.max((end - start) / 60 * 44, 18), left: `${layout.lane / layout.columns * 100}%`, width: `${100 / layout.columns}%` }} onClick={() => setDay(d)}>
                  {s.start.slice(0, 10) < d ? "← " : ""}{s.rateName}
                  <br />
                  {s.start.slice(11)}–{s.end.slice(11)}{s.end.slice(0, 10) > d ? " →" : ""}
                </button>;
              })}
            </div>)}
          </div>}
        </div>
      </div>
      <p className="muted">Toca un día para ver o agregar turnos. Gris: sin cobro. Las franjas continuas representan un solo turno.</p>
    </section>}
    {tab === "pending" && <section className="panel">
      <h2>Horas acumuladas sin boleta</h2>
      <div className="stat-grid">
        <div>
          <span>Con cobro pendiente</span>
          <strong>
            {duration(pending.reduce((n, s) => n + minutes(s), 0))}
          </strong>
          <span>
            {money(pending.reduce((n, s) => n + amount(s), 0))} bruto</span>
        </div>
        <div>
          <span>Sin cobro · registro completo</span>
          <strong>
            {duration(data.shifts.filter(s => s.noCharge).reduce((n, s) => n + minutes(s), 0))}
          </strong>
          <span>No se incluyen en las boletas</span>
        </div>
      </div>
      {data.institutions.map(i => {
        const list = pending.filter(s => s.institutionId === i.id); return <details className="pending-institution" key={i.id}>
          <summary>
            <strong>{i.name}</strong>
            <span>{list.length} {list.length === 1 ? "turno" : "turnos"} · {duration(list.reduce((n, s) => n + minutes(s), 0))} · {money(list.reduce((n, s) => n + amount(s), 0))}</span>
          </summary>
          {list.length ? list.sort((a, b) => a.start.localeCompare(b.start)).map(shiftCard) : <p>Sin turnos pendientes.</p>}
        </details>;
      })}
    </section>}
    {tab === "closing" && <section className="panel closing-panel">
      <h2>Consolidar período</h2>
      <div className="form-grid">
        <label>Institución<select value={institutionId} onChange={e => chooseClosing(e.target.value)}>
          <option value="">Selecciona institución</option>
          {data.institutions.map(i => <option key={i.id} value={i.id}>
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
      {institutionId && <>
        <h3>Turnos anteriores sin boleta ({earlier.length})</h3>
        <p className="muted">No están seleccionados. Puedes incluirlos como excepción al período.</p>
        {earlier.map(s => selectRow(s, true))}
        <h3>Turnos del período ({eligible.length})</h3>
        {eligible.map(s => selectRow(s, false))}{!eligible.length && <p>No hay turnos disponibles en este período.</p>}
        <label>Tipo de boleta<select value={taxType} onChange={e => setTaxType(e.target.value as TaxType)}>
          <option value="receptor_retiene">Receptor retiene</option>
          <option value="emisor_paga_ppm">Emisor paga PPM</option>
        </select>
        </label>
        <p>Fecha de consolidación: {label(localDate())}
        </p>
        {taxRate === undefined && <p role="alert">Configura la tasa de {taxYear} antes de consolidar.</p>}{summary(preview, taxType, taxRate ?? 0)}
        <button className="primary" disabled={!ready || !picked.length || taxRate === undefined} onClick={consolidate}>Consolidar {picked.length} turno(s)</button>
      </>}
    </section>}
    {tab === "history" && <section className="panel">
      <h2>Boletas consolidadas</h2>
      <div className="form-grid">
        <label>Institución<select value={historyFilter.institution} onChange={e => setHistoryFilter({ ...historyFilter, institution: e.target.value })}>
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
          {c.institutionName} · {label(c.from)} al {label(c.to)}
        </p>
        <p>Consolidada el {label(c.date)} · {c.shiftIds.length} turnos · {money(totals(shiftsOf(c), c.taxType, c.taxRate).gross)} bruto</p>
        <div className="actions">
          <button onClick={() => setDetail(c.id)}>Ver detalle</button>
          <button onClick={() => void exportExcel([c], true)}>Compartir / Excel</button>
          <button className="danger" onClick={() => setConfirmation({ next: { ...data, closings: data.closings.filter(n => n.id !== c.id) }, text: `¿Eliminar «${c.name}»? Sus turnos volverán a estar disponibles para consolidar.` })}>Eliminar</button>
        </div>
      </article>)}
    </section>}
    {tab === "settings" && <Settings data={data} ready={ready} commit={commit} confirm={setConfirmation} backup={() => download(new Blob([JSON.stringify({ format: "gestor-boletas-honorarios-backup", version: 2, createdAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" }), `Respaldo_turnos_${localDate()}.json`)} restore={() => fileRef.current?.click()} changeData={()=>setNameDialog(true)} />}
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
        <div className="form-grid turn-identity">
          <label>Institución<select required value={editor.institutionId} onChange={e => setEditor({ ...editor, institutionId: e.target.value })}>
            <option value="">Selecciona institución</option>
            {data.institutions.map(i => <option key={i.id} value={i.id}>
              {i.name}
            </option>)}
          </select>
          </label>
          <label>Nombre turno<select required value={editor.rateId} onChange={e => {
            const rate = data.rates.find(r => r.id === e.target.value);
            if (rate) setEditor(applyRate(editor, rate));
          }}>
            <option value="">Selecciona turno</option>
            {data.rates.map(r => <option key={r.id} value={r.id}>{r.name} · {money(r.amount)}/h</option>)}
          </select>
          </label>
        </div>
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
        {editor.rateId && <p>Valor guardado: {money(editor.amount)}/h · Total {money(Math.max(0, amount(editor)) || 0)}</p>}
        <label>Comentario opcional<textarea value={editor.comment} onChange={e => setEditor({ ...editor, comment: e.target.value })} />
        </label>
        <button className="primary" disabled={!ready}>Guardar turno</button>
      </form>
    </Dialog>}
    {currentClosing && <Dialog title={currentClosing.name} onClose={() => setDetail(null)}>
      <p>
        {currentClosing.institutionName} · {label(currentClosing.from)} al {label(currentClosing.to)}
      </p>
      <p>Consolidación: {label(currentClosing.date)} · {typeLabel(currentClosing.taxType)}
      </p>
      {summary(totals(shiftsOf(currentClosing), currentClosing.taxType, currentClosing.taxRate), currentClosing.taxType, currentClosing.taxRate)}
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
        <option value="replace">Reemplazar con respaldo</option>
      </select>
      </label>
      <p>
        {importMode === "replace" ? `Reemplazará ${data.shifts.length} turnos y ${data.closings.length} boletas actuales. Descarga primero un respaldo si quieres conservarlos.` : importMode === "all" ? "Agrega copias independientes de todos los turnos y boletas del archivo." : "Conserva los registros locales con el mismo ID e incorpora los faltantes. No sobrescribe correcciones locales."}
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
function Settings({ data, ready, commit, confirm, backup, restore, changeData }: {
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
}) {
  const [overnightNotice, setOvernightNotice] = useState(false);
  return <section className="panel">
    <h2>Configuración</h2>
    {overnightNotice && <Dialog title="Horario del turno" onClose={() => setOvernightNotice(false)}>
      <p>{OVERNIGHT_NOTICE}</p>
      <button className="primary" onClick={() => setOvernightNotice(false)}>Entendido</button>
    </Dialog>}
    <h3>Período habitual</h3>
    <form className="form-grid" key={`${data.periodStart}-${data.periodEnd}`} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); commit({ ...data, periodStart: Number(f.get("start")), periodEnd: Number(f.get("end")) }); }}>
      <label>Día de inicio<input name="start" type="number" min="1" max="31" required defaultValue={data.periodStart} />
      </label>
      <label>Día de término<input name="end" type="number" min="1" max="31" required defaultValue={data.periodEnd} />
      </label>
      <button disabled={!ready}>Guardar período</button>
    </form>
    <p className="muted">Si el día final es menor al inicial, corresponde al mes siguiente. Los días inexistentes se ajustan al último día del mes.</p>
    <h3>Turnos y valores hora</h3>
    {data.rates.map(rate => <RateForm key={`${rate.id}-${rate.name}-${rate.amount}-${rate.defaultStart}-${rate.defaultEnd}`} rate={rate} ready={ready} onOvernight={() => setOvernightNotice(true)}
      onSave={updated => commit({ ...data, rates: data.rates.map(r => r.id === rate.id ? updated : r) })}
      onDelete={rate.noCharge ? undefined : () => confirm({ next: { ...data, rates: data.rates.filter(r => r.id !== rate.id) }, text: `¿Eliminar «${rate.name}»?` })}
      canDelete={!data.shifts.some(s => s.rateId === rate.id)} />)}
    <RateForm ready={ready} onOvernight={() => setOvernightNotice(true)} onSave={rate => commit({ ...data, rates: [...data.rates, rate] })} />
    <p className="muted">Al seleccionar un nombre turno se cargan sus horarios y valor. Puedes ajustar el horario de cada registro. Cambiar la configuración no modifica turnos ya guardados.</p>
    <h3>Instituciones</h3>
    <p className="muted">Marca el pin de la institución que quieres seleccionar por defecto en nuevos turnos y boletas. Al marcar otra, la anterior deja de ser predeterminada.</p>
    {data.institutions.map(i => <form className="settings-row" key={`${i.id}-${i.name}`} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); commit({ ...data, institutions: data.institutions.map(n => n.id === i.id ? { ...i, name: String(f.get("name")).trim(), invoiceTaxType: String(f.get("type")) as TaxType } : n) }); }}>
      <button type="button" className={`institution-pin ${preferredInstitution(data)===i.id?"pinned":""}`} aria-pressed={preferredInstitution(data)===i.id} aria-label={`Usar ${i.name} como institución predeterminada`} title={preferredInstitution(data)===i.id?"Institución predeterminada":"Marcar como predeterminada"} disabled={!ready} onClick={()=>commit({...data,defaultInstitutionId:i.id})}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3h8l-1 7 4 4H5l4-4-1-7Z"/><path d="M12 14v8"/></svg>
        {preferredInstitution(data)===i.id&&<span>Predeterminada</span>}
      </button>
      <input name="name" aria-label={`Nombre de ${i.name}`} defaultValue={i.name} required />
      <select name="type" aria-label={`Modalidad predeterminada ${i.name}`} defaultValue={i.invoiceTaxType}>
        <option value="receptor_retiene">Receptor retiene</option>
        <option value="emisor_paga_ppm">Emisor paga PPM</option>
      </select>
      <button disabled={!ready}>Guardar</button>
      <button type="button" className="danger" disabled={data.institutions.length === 1 || data.shifts.some(s => s.institutionId === i.id) || data.closings.some(c => c.institutionId === i.id)} onClick={() => confirm({ next: { ...data, institutions: data.institutions.filter(n => n.id !== i.id), defaultInstitutionId: data.defaultInstitutionId===i.id?undefined:data.defaultInstitutionId }, text: `¿Eliminar «${i.name}»?` })}>Eliminar</button>
    </form>)}
    <form className="settings-row" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget); if (commit({ ...data, institutions: [...data.institutions, { id: uid(), name: String(f.get("name")).trim(), invoiceTaxType: "receptor_retiene" }] }))
        e.currentTarget.reset();
    }}>
      <input name="name" aria-label="Nueva institución" placeholder="Nueva institución" required />
      <button disabled={!ready}>Agregar institución</button>
    </form>
    <details className="tax-settings">
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
    <h3>Respaldo y recuperación</h3>
    <p>Incluye turnos, boletas y configuración. Puedes importar todo, importar sin duplicados o reemplazar, después de confirmar.</p>
    <div className="actions">
      <button disabled={!ready} onClick={backup}>Descargar respaldo</button>
      <button onClick={restore}>Recuperar respaldo</button>
    </div>
    <h3>Datos</h3>
    <div className="profile-details">
      <p><strong>Nombre:</strong> {data.userName??"Sin registrar"}</p>
      <p><strong>RUT:</strong> {data.userRut?`${data.userRut.number}-${data.userRut.verifier}`:"Sin registrar"}</p>
    </div>
    <button disabled={!ready} onClick={changeData}>Cambiar datos</button>
  </section>;
}

const OVERNIGHT_NOTICE = "Atención: la hora de término es anterior a la hora de inicio. Se asumirá que el turno termina al día siguiente, después de las 00:00.";
function RateForm({ rate, ready, onSave, onDelete, canDelete, onOvernight }: { rate?: Rate; ready: boolean; onSave: (rate: Rate) => boolean; onDelete?: () => void; canDelete?: boolean; onOvernight: () => void }) {
  const [start, setStart] = useState(rate?.defaultStart ?? "08:00");
  const [end, setEnd] = useState(rate?.defaultEnd ?? "09:00");
  const [error, setError] = useState("");
  const overnight = end < start;
  return <article className="rate-setting">
    <form className="rate-form" aria-label={rate ? `Configurar ${rate.name}` : "Agregar nombre turno"} onSubmit={e => {
      e.preventDefault();
      if (start === end) { setError("La hora de inicio y la hora de término deben ser diferentes."); return; }
      const form = e.currentTarget, fields = new FormData(form);
      const updated: Rate = { ...rate, id: rate?.id ?? uid(), name: String(fields.get("name")).trim(), amount: rate?.noCharge ? 0 : Number(fields.get("amount")), defaultStart: start, defaultEnd: end };
      if (onSave(updated)) {
        setError("");
        if (!rate) { form.reset(); setStart("08:00"); setEnd("09:00"); }
        if (overnight) onOvernight();
      }
    }}>
      <label>Nombre turno<input name="name" required defaultValue={rate?.name ?? ""} readOnly={rate?.noCharge} placeholder="Nombre del turno" />
      </label>
      <label>Valor hora<input name="amount" type="number" min="0" step="1" required defaultValue={rate?.amount ?? ""} readOnly={rate?.noCharge} />
      </label>
      <label>Hora inicio por defecto<input type="time" required value={start} onChange={e => setStart(e.target.value)} />
      </label>
      <label>Hora fin por defecto<input type="time" required value={end} onChange={e => setEnd(e.target.value)} />
      </label>
      <div className="actions">
        <button disabled={!ready}>{rate ? "Guardar" : "Agregar turno"}</button>{onDelete && <button type="button" className="danger" disabled={!canDelete} onClick={onDelete}>Eliminar</button>}</div>
    </form>
    {overnight && <p role="status" className="schedule-note">{OVERNIGHT_NOTICE}</p>}
    {error && <p role="alert">{error}</p>}
  </article>;
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

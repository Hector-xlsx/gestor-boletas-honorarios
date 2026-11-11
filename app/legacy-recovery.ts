import type { Data, Shift, Closing, TaxType } from "./turnos";

export type LegacySource = { invoices: unknown[]; taxRates: unknown[] };
export type RecoveryRow = { name: string; institution: string; from: string; to: string; shifts: number; minutes: number; gross: number; warnings: string[] };
export type RecoveryPlan = { next: Data; found: number; skipped: number; rows: RecoveryRow[]; issues: string[] };

export function readLegacyBrowser(storage: Pick<Storage, "getItem">): LegacySource {
  try {
    const invoices: unknown = JSON.parse(storage.getItem("cobro-horas-invoices") ?? "[]");
    const taxRates: unknown = JSON.parse(storage.getItem("cobro-horas-tax-rates") ?? "[]");
    if (!Array.isArray(invoices) || !Array.isArray(taxRates)) throw new Error();
    return { invoices, taxRates };
  } catch {
    throw new Error("No se pudieron leer los datos anteriores. Se conservan intactos; no se ha recuperado ningún registro.");
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Registro incompleto.");
  return value as Record<string, unknown>;
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function nonnegative(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Horas o valores inválidos.");
  return value;
}
function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + "T00:00:00Z")) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) throw new Error("Fecha anterior inválida.");
  return value;
}
function key(value: string): string { return value.normalize("NFC").trim().toLocaleLowerCase("es-CL"); }
function minutesOf(hours: unknown, minutes: unknown): number {
  const result = nonnegative(hours) * 60 + nonnegative(minutes);
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error("La duración debe ser un número positivo de minutos.");
  return result;
}
function addMinutes(start: string, minutes: number): string {
  const end = new Date(Date.parse(start + ":00Z") + minutes * 60000);
  if (!Number.isFinite(end.getTime())) throw new Error("La duración no puede convertirse en un horario.");
  return end.toISOString().slice(0, 16);
}
function civilDate(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`; }

export function prepareLegacyRecovery(current: Data, source: LegacySource): RecoveryPlan {
  let next = structuredClone(current);
  const plan: RecoveryPlan = { next, found: source.invoices.length, skipped: 0, rows: [], issues: [] };
  const imported = new Set(current.legacyImportedInvoiceIds ?? []);
  source.invoices.forEach((raw, index) => {
    try {
      const invoice = record(raw), sourceId = text(invoice.id);
      if (!sourceId) throw new Error("Falta el identificador original de la boleta.");
      if (imported.has(sourceId)) { plan.skipped++; return; }
      const working = structuredClone(next);
      const result = convertInvoice(working, invoice, source.taxRates);
      imported.add(sourceId);
      working.legacyImportedInvoiceIds = [...imported];
      next = working;
      plan.rows.push(result);
    } catch (error) {
      plan.issues.push(`Boleta anterior ${index + 1}: ${error instanceof Error ? error.message : "No se pudo convertir."}`);
    }
  });
  plan.next = next;
  return plan;
}

function convertInvoice(data: Data, invoice: Record<string, unknown>, sourceTaxRates: unknown[]): RecoveryRow {
  const institutionName = text(invoice.institutionName);
  const taxType = invoice.invoiceTaxType as TaxType;
  if (!institutionName || !["receptor_retiene", "emisor_paga_ppm"].includes(taxType)) throw new Error("La institución o modalidad no es válida.");
  if (!Array.isArray(invoice.entries) || !invoice.entries.length) throw new Error("La boleta no tiene líneas de horas.");
  const invoiceDate = date(invoice.invoiceDate);
  let institution = data.institutions.find(i => !i.archived && key(i.name) === key(institutionName) && key(i.institutionName || i.name) === key(institutionName));
  if (!institution) {
    institution = { id: crypto.randomUUID(), name: institutionName, institutionName, invoiceTaxType: taxType };
    data.institutions.push(institution);
  }
  const dates: string[] = [], shifts: Shift[] = [], warnings: string[] = [];
  let totalMinutes = 0, gross = 0;
  for (let entryIndex = 0; entryIndex < invoice.entries.length; entryIndex++) {
    const entry = record(invoice.entries[entryIndex]);
    const from = date(entry.startDate), to = date(entry.endDate);
    if (from > to) throw new Error("El período de una línea está invertido.");
    dates.push(from, to);
    if (!["single", "total", "perDay"].includes(String(entry.timeMode))) throw new Error("Modo de duración desconocido.");
    const perDay = entry.timeMode === "perDay";
    const dailyMinutes = minutesOf(perDay ? entry.hoursPerDay : entry.hours, perDay ? entry.minutesPerDay : entry.minutes);
    const count = perDay ? nonnegative(entry.daysCount) : 1;
    if (!Number.isSafeInteger(count) || count < 1 || shifts.length + count > 10000) throw new Error("La cantidad de días de la línea no es válida o es demasiado grande.");
    if (perDay && count !== (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000 + 1) throw new Error("La cantidad de días no coincide con el período original.");
    const hourly = nonnegative(entry.valueAmount), name = text(entry.valueName) || "Turno recuperado";
    let rate = data.rates.find(r => !r.archived && !r.noCharge && key(r.name) === key(name) && r.amount === hourly);
    if (!rate) { rate = { id: crypto.randomUUID(), name, amount: hourly }; data.rates.push(rate); }
    const lineGross = Math.round(hourly * (dailyMinutes * count / 60));
    if (!Number.isSafeInteger(lineGross)) throw new Error("El monto original no puede representarse con precisión.");
    if (!perDay && from !== to) warnings.push(`Línea ${entryIndex+1}: tenía un total para ${from}–${to}; se conserva como un turno desde el primer día, sin repartir horas entre fechas desconocidas.`);
    let allocated = 0;
    for (let day = 0; day < count; day++) {
      const dayDate = new Date(Date.parse(from + "T00:00:00Z") + day * 86400000).toISOString().slice(0, 10);
      const start = dayDate + "T17:00", end = addMinutes(start, dailyMinutes);
      date(end.slice(0, 10));
      const cumulative = day === count - 1 ? lineGross : Math.round(hourly * (dailyMinutes * (day+1) / 60));
      const allocatedAmount = cumulative - allocated;
      allocated = cumulative;
      const shift: Shift = {
        id: `legacy-v1:${encodeURIComponent(String(invoice.id))}:${entryIndex}:${day}`,
        start, end, institutionId: institution.id, rateId: rate.id, rateName: name, amount: hourly, noCharge: false,
        comment: [text(entry.comment), text(invoice.gloss), "Recuperado de la versión anterior. Inicio a las 17:00 por criterio de recuperación.", from !== to ? `Período original: ${from}–${to}.` : ""].filter(Boolean).join(" "),
      };
      if (allocatedAmount !== Math.round(dailyMinutes * hourly / 60)) shift.importedAmount = { amount: allocatedAmount, minutes: dailyMinutes, hourly };
      if (data.shifts.some(s => s.id === shift.id)) throw new Error("Ya existe un turno con el identificador de esta recuperación; no se duplicará.");
      shifts.push(shift);
    }
    gross += lineGross;
    totalMinutes += dailyMinutes * count;
  }
  if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(totalMinutes)) throw new Error("El total no puede representarse con precisión.");
  if (typeof invoice.totalHonorarios === "number" && invoice.totalHonorarios !== gross) throw new Error("El bruto guardado no coincide con sus líneas. No se modificó la boleta; requiere revisión.");
  const year = Number(invoiceDate.slice(0, 4));
  const legacyRates = new Map<number,number>([[2025,14.5],[2026,15.25],[2027,16],[2028,17],[2029,17],[2030,17]]);
  for (const value of sourceTaxRates) {
    if (!value || typeof value !== "object") continue;
    const t = record(value);
    if (typeof t.year === "number" && Number.isInteger(t.year) && typeof t.rate === "number" && t.rate >= 0 && t.rate <= 100) legacyRates.set(t.year,t.rate);
  }
  const orderedRates = [...legacyRates].sort((a,b) => b[0]-a[0]);
  const fallback = orderedRates.find(t => t[0] === year) ?? orderedRates.find(t => t[0] < year);
  const taxRate = invoice.taxRateUsed === undefined ? Number(fallback?.[1] ?? 17) : nonnegative(invoice.taxRateUsed);
  if (taxRate > 100) throw new Error("La tasa guardada no es válida.");
  const tax = Math.round(gross * taxRate / 100);
  const expected = { retencion: taxType === "receptor_retiene" ? tax : 0, ppm: taxType === "emisor_paga_ppm" ? tax : 0, pagoDesdeReceptor: taxType === "receptor_retiene" ? gross-tax : gross, netoDespuesImpuesto: gross-tax };
  for (const [field,value] of Object.entries(expected)) if (typeof invoice[field] === "number" && invoice[field] !== value) throw new Error("Los impuestos guardados no coinciden con el cálculo original. La boleta requiere revisión.");
  const from = [...dates].sort()[0], to = [...dates].sort().at(-1)!;
  const created = typeof invoice.createdAt === "string" ? new Date(invoice.createdAt) : null;
  const closingDate = created && Number.isFinite(created.getTime()) ? civilDate(created) : invoiceDate;
  if (!created || !Number.isFinite(created.getTime())) warnings.push("Sin fecha de creación válida: se conserva la fecha original de la boleta.");
  const name = text(invoice.invoiceNumber) ? `Boleta recuperada ${text(invoice.invoiceNumber)}` : `Boleta recuperada ${invoiceDate}`;
  const closing: Closing = { id: `legacy-v1:${encodeURIComponent(String(invoice.id))}`, name, institutionId: institution.id, institutionName,
    from, to, date: closingDate, taxType, taxRate, shiftIds: shifts.map(s => s.id), exceptions: [] };
  if (data.closings.some(c => c.id === closing.id)) throw new Error("Esta boleta ya existe en el calendario.");
  data.shifts.push(...shifts);
  data.closings.push(closing);
  return { name, institution: institutionName, from, to, shifts: shifts.length, minutes: totalMinutes, gross, warnings };
}

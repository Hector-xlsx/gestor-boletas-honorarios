export type TaxType = "receptor_retiene" | "emisor_paga_ppm";
export type Rate = {
    id: string;
    name: string;
    amount: number;
    noCharge?: boolean;
    defaultStart?: string;
    defaultEnd?: string;
};
export type Institution = {
    id: string;
    name: string;
    invoiceTaxType: TaxType;
};
export type Shift = {
    id: string;
    start: string;
    end: string;
    institutionId: string;
    rateId: string;
    rateName: string;
    amount: number;
    noCharge: boolean;
    comment: string;
};
export type Closing = {
    id: string;
    name: string;
    institutionId: string;
    institutionName: string;
    from: string;
    to: string;
    date: string;
    taxType: TaxType;
    taxRate: number;
    shiftIds: string[];
    exceptions: string[];
    updatedAt?: string;
};
export type Rut = { number: string; verifier: string };
export function isRut(value: unknown): value is Rut {
    if (!value || typeof value !== "object") return false;
    const rut = value as Rut;
    return typeof rut.number === "string" && /^\d{7,8}$/.test(rut.number) &&
        typeof rut.verifier === "string" && /^[0-9kK]$/.test(rut.verifier);
}
export function normalizeRut(rut: Rut): Rut { return { number: rut.number, verifier: rut.verifier.toUpperCase() }; }
export type Data = {
    userName?: string;
    userRut?: Rut;
    rates: Rate[];
    institutions: Institution[];
    defaultInstitutionId?: string;
    taxRates: {
        year: number;
        rate: number;
    }[];
    periodStart: number;
    periodEnd: number;
    shifts: Shift[];
    closings: Closing[];
};
export const STORAGE = "cobro-horas-calendar-v2";
export const uid = () => crypto.randomUUID();
export function normalizeName(value: string): string {
    const lower = value.trim().normalize("NFC").toLocaleLowerCase("es-CL");
    return lower.charAt(0).toLocaleUpperCase("es-CL") + lower.slice(1);
}
export function preferredInstitution(data: Data): string {
    return data.defaultInstitutionId ?? (data.institutions.length === 1 ? data.institutions[0].id : "");
}
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return localDate(d); }
export function applyRate(shift: Shift, rate: Rate): Shift {
    const start = rate.defaultStart ?? "08:00";
    const end = rate.defaultEnd ?? "09:00";
    const date = shift.start.slice(0, 10);
    return { ...shift, rateId: rate.id, rateName: rate.name, amount: rate.amount, noCharge: !!rate.noCharge,
        start: `${date}T${start}`, end: `${end < start ? addDays(date, 1) : date}T${end}` };
}
// Wall-clock minutes: schedules are entered as local civil times, independent of DST.
export function minutes(shift: Pick<Shift, "start" | "end">) { return (Date.parse(`${shift.end}:00Z`) - Date.parse(`${shift.start}:00Z`)) / 60000; }
export function amount(shift: Shift) { return shift.noCharge ? 0 : Math.round(minutes(shift) * shift.amount / 60); }
export function duration(value: number) { return `${Math.floor(value / 60)} h ${value % 60} min`; }
export function totals(shifts: Shift[], type: TaxType, rate: number) { const gross = shifts.reduce((sum, s) => sum + amount(s), 0); const tax = Math.round(gross * rate / 100); return { minutes: shifts.reduce((sum, s) => sum + minutes(s), 0), gross, tax, payment: type === "receptor_retiene" ? gross - tax : gross, net: gross - tax }; }
export function period(date: string, start: number, end: number) {
    const d = new Date(`${date}T12:00:00`);
    const clamp = (year: number, month: number, day: number) => localDate(new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12));
    let month = d.getMonth();
    const year = d.getFullYear();
    if (d.getDate() < Math.min(start, new Date(year, month + 1, 0).getDate()))
        month--;
    return { from: clamp(year, month, start), to: clamp(year, month + (end < start ? 1 : 0), end) };
}
export function initialData(): Data { return { rates: [{ id: "general", name: "Turno general", amount: 10000 }, { id: "festivo", name: "Turno festivo", amount: 20000 }, { id: "sin-cobro", name: "Turno sin cobro", amount: 0, noCharge: true }], institutions: [{ id: "maipo", name: "CESFAM MAIPO", invoiceTaxType: "receptor_retiene" }], taxRates: [{ year: 2025, rate: 14.5 }, { year: 2026, rate: 15.25 }, { year: 2027, rate: 16 }, { year: 2028, rate: 17 }, { year: 2029, rate: 17 }, { year: 2030, rate: 17 }], periodStart: 16, periodEnd: 15, shifts: [], closings: [] }; }
export function reconcile(data: Data, shift: Shift | null, deletedId?: string): Data {
    const id = shift?.id ?? deletedId;
    const shifts = shift ? [...data.shifts.filter(s => s.id !== id), shift] : data.shifts.filter(s => s.id !== id);
    const closings = data.closings.map(c => {
        if (!c.shiftIds.includes(id!))
            return c;
        const inside = shift && shift.start.slice(0, 10) >= c.from && shift.start.slice(0, 10) <= c.to;
        const retain = shift && !shift.noCharge && shift.institutionId === c.institutionId && (c.exceptions.includes(shift.id) || inside);
        return { ...c, shiftIds: retain ? c.shiftIds : c.shiftIds.filter(s => s !== id), exceptions: retain && !inside ? c.exceptions : c.exceptions.filter(s => s !== id), updatedAt: new Date().toISOString() };
    });
    return { ...data, shifts, closings };
}

export function calendarLanes(shifts: Shift[]): Map<string, { lane: number; columns: number }> {
    const ordered = [...shifts].sort((a, b) => a.start.localeCompare(b.start));
    const result = new Map<string, { lane: number; columns: number }>();
    let group: Shift[] = [];
    let groupEnd = "";
    function flush() {
        const ends: string[] = [];
        for (const s of group) {
            let lane = ends.findIndex(end => end <= s.start);
            if (lane < 0) lane = ends.length;
            ends[lane] = s.end;
            result.set(s.id, { lane, columns: 0 });
        }
        for (const s of group) result.get(s.id)!.columns = ends.length;
        group = [];
    }
    for (const s of ordered) {
        if (group.length && s.start >= groupEnd) flush();
        if (!group.length) groupEnd = s.end;
        group.push(s);
        if (s.end > groupEnd) groupEnd = s.end;
    }
    flush();
    return result;
}

// Importing all creates independent copies, including closing/shift relationships.
// Deduplication keeps local records when their IDs already exist.
export function mergeBackup(current: Data, incoming: Data, mode: "all" | "deduplicate"): Data {
    validateData(current);
    validateData(incoming);
    const next: Data = structuredClone(current);
    if (!next.userName && incoming.userName) next.userName = incoming.userName;
    if (!next.userRut && incoming.userRut && (!current.userName || normalizeName(current.userName) === normalizeName(incoming.userName ?? "")))
        next.userRut = normalizeRut(incoming.userRut);
    const rateIds = new Map<string, string>();
    for (const r of incoming.rates) {
        const existing = next.rates.find(n => r.noCharge ? n.noCharge : !n.noCharge && n.name === r.name && n.amount === r.amount &&
            (n.defaultStart ?? "08:00") === (r.defaultStart ?? "08:00") && (n.defaultEnd ?? "09:00") === (r.defaultEnd ?? "09:00"));
        const id = existing?.id ?? uid();
        rateIds.set(r.id, id);
        if (!existing) next.rates.push({ ...r, id });
    }
    const institutionIds = new Map<string, string>();
    for (const i of incoming.institutions) {
        const existing = next.institutions.find(n => n.name.trim().toLocaleLowerCase() === i.name.trim().toLocaleLowerCase());
        const id = existing?.id ?? uid();
        institutionIds.set(i.id, id);
        if (!existing) next.institutions.push({ ...i, id });
    }
    if (!preferredInstitution(current) && incoming.defaultInstitutionId)
        next.defaultInstitutionId = institutionIds.get(incoming.defaultInstitutionId);
    for (const t of incoming.taxRates) if (!next.taxRates.some(n => n.year === t.year)) next.taxRates.push(t);
    const shiftIds = new Map<string, string>();
    for (const s of incoming.shifts) {
        const existing = mode === "deduplicate" && next.shifts.find(n => n.id === s.id);
        const id = existing ? existing.id : mode === "all" ? uid() : s.id;
        shiftIds.set(s.id, id);
        if (!existing) next.shifts.push({ ...s, id, rateId: rateIds.get(s.rateId)!, institutionId: institutionIds.get(s.institutionId)! });
    }
    const assigned = new Set(next.closings.flatMap(c => c.shiftIds));
    for (const c of incoming.closings) {
        if (mode === "deduplicate" && next.closings.some(n => n.id === c.id)) continue;
        const institutionId = institutionIds.get(c.institutionId)!;
        const ids = c.shiftIds.map(id => shiftIds.get(id)!).filter(id => {
            const s = next.shifts.find(s => s.id === id)!;
            return !assigned.has(id) && !s.noCharge && s.institutionId === institutionId;
        });
        const exceptions = ids.filter(id => {
            const s = next.shifts.find(s => s.id === id)!;
            return s.start.slice(0, 10) < c.from || s.start.slice(0, 10) > c.to;
        });
        next.closings.push({ ...c, id: mode === "all" ? uid() : c.id, institutionId, shiftIds: ids, exceptions });
        ids.forEach(id => assigned.add(id));
    }
    validateData(next);
    return next;
}
export function validateData(value: unknown): asserts value is Data {
    const data = value as Data;
    const fail = () => { throw new Error("El respaldo no tiene un formato de calendario válido."); };
    if (!data || !Array.isArray(data.rates) || !Array.isArray(data.institutions) || !Array.isArray(data.taxRates) || !Array.isArray(data.shifts) || !Array.isArray(data.closings))
        fail();
    if (data.userName !== undefined && (typeof data.userName !== "string" || !data.userName.trim() || data.userName.length > 80))
        fail();
    if (data.userRut !== undefined && !isRut(data.userRut)) fail();
    const unique = (items: {
        id: string;
    }[]) => items.every(i => typeof i.id === "string" && i.id.length > 0) && new Set(items.map(i => i.id)).size === items.length;
    if (![data.rates, data.institutions, data.shifts, data.closings].every(unique) || !data.rates.length || !data.institutions.length)
        fail();
    if (data.defaultInstitutionId !== undefined && !data.institutions.some(i => i.id === data.defaultInstitutionId))
        fail();
    if (![data.periodStart, data.periodEnd].every(n => Number.isInteger(n) && n >= 1 && n <= 31))
        fail();
    const taxType = (t: string) => ["receptor_retiene", "emisor_paga_ppm"].includes(t);
    const validClock = (s: unknown) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
    if (!data.rates.every(r => (r.defaultStart === undefined && r.defaultEnd === undefined) ||
        (validClock(r.defaultStart) && validClock(r.defaultEnd) && r.defaultStart !== r.defaultEnd)))
        throw new Error("Los horarios predeterminados deben ser válidos y diferentes entre sí.");
    if (!data.rates.every(r => typeof r.name === "string" && r.name.trim() && Number.isFinite(r.amount) && r.amount >= 0 && (!r.noCharge || r.amount === 0)) || !data.rates.some(r => r.noCharge))
        fail();
    if (!data.institutions.every(i => typeof i.name === "string" && i.name.trim() && taxType(i.invoiceTaxType)) || !data.taxRates.length || new Set(data.taxRates.map(t => t.year)).size !== data.taxRates.length || !data.taxRates.every(t => Number.isInteger(t.year) && Number.isFinite(t.rate) && t.rate >= 0 && t.rate <= 100))
        fail();
    const validTime = (s: string) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}:00Z`)) && new Date(`${s}:00Z`).toISOString().slice(0, 16) === s;
    if (!data.shifts.every(s => validTime(s.start) && validTime(s.end) && minutes(s) > 0 && typeof s.noCharge === "boolean" && Number.isFinite(s.amount) && s.amount >= 0 && typeof s.rateName === "string" && typeof s.comment === "string" && data.institutions.some(i => i.id === s.institutionId) && data.rates.some(r => r.id === s.rateId)))
        fail();
    const assigned = new Set<string>();
    for (const c of data.closings) {
        if (!c || typeof c.name !== "string" || !c.name.trim() || typeof c.institutionName !== "string" || !data.institutions.some(i => i.id === c.institutionId) || !taxType(c.taxType) || !Number.isFinite(c.taxRate) || c.taxRate < 0 || c.taxRate > 100 || ![c.from, c.to, c.date].every(d => validTime(`${d}T00:00`)) || c.from > c.to || !Array.isArray(c.shiftIds) || !Array.isArray(c.exceptions) || !c.exceptions.every(id => c.shiftIds.includes(id)))
            fail();
        for (const id of c.shiftIds) {
            const s = data.shifts.find(s => s.id === id);
            if (!s || assigned.has(id) || s.noCharge || s.institutionId !== c.institutionId || (!(s.start.slice(0, 10) >= c.from && s.start.slice(0, 10) <= c.to) && !c.exceptions.includes(id)))
                fail();
            assigned.add(id);
        }
    }
}

import { normalizeName, uid, validateData } from "./turnos";
import type { Data, ReportTemplate } from "./turnos";

export const TRIAL_STORAGE = "cobro-horas-version-2-trial";
export const RECOMMENDED_CATEGORIES = ["Turno", "Apoyo"];
const reportTemplates: Record<string, ReportTemplate> = { Turno: "turno", Apoyo: "apoyo" };
const standard = 22170;
const recommendedRates = [
  { name: "Estándar", amount: standard },
  { name: "Estándar ×1,5", amount: standard * 1.5 },
  { name: "Domingo", amount: 25670 },
];

export function trialId(storage: Storage): string | null {
  const raw = storage.getItem(TRIAL_STORAGE);
  if (raw === null) return null;
  const session = JSON.parse(raw);
  if (typeof session?.id !== "string" || !session.id)
    throw new Error("No se pudo identificar la sesión de la versión 2.");
  return session.id;
}

export function startTrial(storage: Storage, data: Data): string {
  if (storage.getItem(TRIAL_STORAGE) !== null)
    throw new Error("La versión 2 ya está activa. Recarga esta pestaña.");
  validateData(data);
  const institutions = data.institutions.map(i => i.archived ? i : { ...i, legacyCategory: true as const });
  const rates = [...data.rates];
  for (const name of RECOMMENDED_CATEGORIES) {
    const reportTemplate = reportTemplates[name];
    let category = institutions.find(i => !i.archived && normalizeName(i.name) === name);
    if (category) {
      category = { ...category, institutionName: "CESFAM MAIPO", legacyCategory: undefined, reportTemplate };
      institutions[institutions.findIndex(i => i.id === category!.id)] = category;
    } else {
      category = { id: uid(), name, institutionName: "CESFAM MAIPO", invoiceTaxType: "receptor_retiene", reportTemplate };
      institutions.push(category);
    }
    for (const template of recommendedRates) {
      if (!rates.some(r => !r.archived && r.categoryId === category.id && normalizeName(r.name) === template.name))
        rates.push({ ...template, id: uid(), categoryId: category.id });
    }
  }
  const closed = new Set(data.closings.flatMap(c => c.shiftIds));
  const shifts = data.shifts.map(s => closed.has(s.id) ? s : { ...s, reviewed: undefined });
  const next = { ...data, institutions, rates, shifts };
  validateData(next);
  const id = uid();
  writeSession(storage, id, next);
  return id;
}

export function readTrial(storage: Storage, id: string): string {
  const raw = storage.getItem(TRIAL_STORAGE);
  const session = raw === null ? null : JSON.parse(raw);
  if (session?.id !== id)
    throw new Error("La versión activa cambió. Recarga esta pestaña.");
  if (!session.reportTemplatesInitialized) {
    const data: Data = session.data;
    validateData(data);
    const institutions = [...data.institutions];
    for (const name of RECOMMENDED_CATEGORIES) {
      const reportTemplate = reportTemplates[name];
      if (institutions.some(i => i.reportTemplate === reportTemplate)) continue;
      const matches = institutions.filter(i => !i.legacyCategory && !i.reportTemplate &&
        normalizeName(i.name) === name && i.institutionName === "CESFAM MAIPO" &&
        recommendedRates.every(rate => data.rates.some(r => r.categoryId === i.id && r.name === rate.name)));
      if (matches.length === 1) {
        const category = matches[0];
        institutions[institutions.indexOf(category)] = { ...category, reportTemplate };
      }
    }
    session.data = { ...data, institutions };
    writeSession(storage, id, session.data);
  }
  return JSON.stringify(session.data);
}

export function writeTrial(storage: Storage, id: string, data: Data) {
  readTrial(storage, id);
  writeSession(storage, id, data);
}

function writeSession(storage: Storage, id: string, data: Data) {
  storage.setItem(TRIAL_STORAGE, JSON.stringify({ id, data, reportTemplatesInitialized: true }));
}

export function endTrial(storage: Storage, id: string) {
  readTrial(storage, id);
  storage.removeItem(TRIAL_STORAGE);
}

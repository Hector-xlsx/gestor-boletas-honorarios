import { uid, validateData } from "./turnos";
import type { Data } from "./turnos";

export const TRIAL_STORAGE = "cobro-horas-version-2-trial";

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
  const id = uid();
  storage.setItem(TRIAL_STORAGE, JSON.stringify({ id, data }));
  return id;
}

export function readTrial(storage: Storage, id: string): string {
  const raw = storage.getItem(TRIAL_STORAGE);
  const session = raw === null ? null : JSON.parse(raw);
  if (session?.id !== id)
    throw new Error("La versión activa cambió. Recarga esta pestaña.");
  return JSON.stringify(session.data);
}

export function writeTrial(storage: Storage, id: string, data: Data) {
  readTrial(storage, id);
  storage.setItem(TRIAL_STORAGE, JSON.stringify({ id, data }));
}

export function endTrial(storage: Storage, id: string) {
  readTrial(storage, id);
  storage.removeItem(TRIAL_STORAGE);
}

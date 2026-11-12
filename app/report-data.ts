import { amount, minutes } from "./turnos";
import type { Shift } from "./turnos";

export function dailyReport(shifts: Shift[]) {
  const days = new Map<string, { date: string; minutes: number; amount: number }>();
  for (const shift of shifts) {
    const date = shift.start.slice(0, 10);
    const row = days.get(date) ?? { date, minutes: 0, amount: 0 };
    row.minutes += minutes(shift);
    row.amount += amount(shift);
    days.set(date, row);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

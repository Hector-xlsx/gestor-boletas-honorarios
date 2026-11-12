import { find, read, write } from "cfb";
import { dailyReport } from "./report-data";
import type { Closing, Provider, ReportTemplate, Rut, Shift } from "./turnos";

const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const hours = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const dateLabel = (date: string) => date.split("-").reverse().join("/");

function fill(root: Document | Element, values: Record<string, string>) {
  for (const node of root.getElementsByTagNameNS(word, "t")) {
    const token = /^\{\{([A-Z]+)\}\}$/.exec(node.textContent ?? "");
    if (token && Object.hasOwn(values, token[1])) node.textContent = values[token[1]];
  }
}

export async function createWordReport(template: ReportTemplate, closing: Closing, shifts: Shift[], provider: Provider, rut: Rut) {
  const response = await fetch(new URL(`report-templates/${template}.docx`, document.baseURI));
  if (!response.ok) throw new Error("No se pudo cargar la plantilla Word.");
  const archive = read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
  const entry = find(archive, "/word/document.xml");
  if (!entry) throw new Error("La plantilla Word está incompleta.");
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(Uint8Array.from(entry.content)), "application/xml");
  const detail = xml.getElementsByTagNameNS(word, "tbl")[1];
  const example = detail?.getElementsByTagNameNS(word, "tr")[1];
  if (!example) throw new Error("La plantilla Word no tiene una fila de detalle.");

  const days = dailyReport(shifts);
  for (const day of days) {
    const row = example.cloneNode(true) as Element;
    fill(row, {
      DATE: dateLabel(day.date),
      HOURS: hours.format(day.minutes / 60),
      AMOUNT: money.format(day.amount),
    });
    detail.insertBefore(row, example);
  }
  example.remove();
  fill(xml, {
    NAME: provider.name,
    RUN: `${rut.number}-${rut.verifier}`,
    OCCUPATION: provider.occupation,
    SECTOR: provider.sector,
    PERIOD: `${dateLabel(closing.from)} al ${dateLabel(closing.to)}`,
    TOTAL: hours.format(days.reduce((sum, day) => sum + day.minutes, 0) / 60),
    NUMBER: closing.invoiceNumber ?? "",
  });
  entry.content = new TextEncoder().encode(new XMLSerializer().serializeToString(xml));
  entry.size = entry.content.length;
  const bytes = write(archive, { type: "array", fileType: "zip", compression: true });
  return new Blob([Uint8Array.from(bytes)], { type: mime });
}

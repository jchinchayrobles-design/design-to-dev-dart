import type { ContrastItem, ContrastStatus } from "./types";

/** Severity order: what needs attention first. */
export const STATUS_ORDER: ContrastStatus[] = ["riesgo", "excepcion", "sin_evidencia", "cumple"];

export function countByStatus(items: Pick<ContrastItem, "status">[]): Record<ContrastStatus, number> {
  const c: Record<ContrastStatus, number> = { riesgo: 0, excepcion: 0, sin_evidencia: 0, cumple: 0 };
  for (const i of items) c[i.status]++;
  return c;
}

/** Returns original indexes sorted by severity, preserving original order within a status. */
export function sortBySeverity(items: Pick<ContrastItem, "status">[]): number[] {
  return items
    .map((it, i) => ({ i, r: STATUS_ORDER.indexOf(it.status) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.i);
}

export type OverallState = "sin_observaciones" | "requiere_atencion" | "evidencia_insuficiente";

export function overallState(items: Pick<ContrastItem, "status">[]): OverallState {
  const c = countByStatus(items);
  if (c.riesgo || c.excepcion) return "requiere_atencion";
  if (!items.length || c.sin_evidencia) return "evidencia_insuficiente";
  return "sin_observaciones";
}

import { describe, expect, it } from "vitest";
import { countByStatus, overallState, sortBySeverity } from "./contrast-view";

const items = [{ status: "cumple" as const }, { status: "sin_evidencia" as const }, { status: "riesgo" as const }, { status: "excepcion" as const }, { status: "riesgo" as const }];

describe("contrast view rules", () => {
  it("orders risks first, then exceptions, no evidence, compliant", () => {
    expect(sortBySeverity(items)).toEqual([2, 4, 3, 1, 0]);
  });
  it("counts findings per status", () => {
    expect(countByStatus(items)).toEqual({ riesgo: 2, excepcion: 1, sin_evidencia: 1, cumple: 1 });
  });
  it("requires attention when any risk or exception exists", () => {
    expect(overallState(items)).toBe("requiere_atencion");
  });
  it("is insufficient evidence when nothing is supported", () => {
    expect(overallState([{ status: "sin_evidencia" }])).toBe("evidencia_insuficiente");
    expect(overallState([])).toBe("evidencia_insuficiente");
  });
  it("has no observations only when everything complies", () => {
    expect(overallState([{ status: "cumple" }])).toBe("sin_observaciones");
  });
});

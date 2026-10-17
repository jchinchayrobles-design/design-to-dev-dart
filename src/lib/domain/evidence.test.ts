import { describe, expect, it } from "vitest";
import { resolveFindingStatus, verifyQuote } from "./evidence";

const source = "Artículo 5. Los créditos mayores a S/ 500,000 requieren\naprobación del   Comité de Riesgos.";

describe("verifyQuote", () => {
  it("accepts a literal quote despite whitespace and case differences", () => {
    expect(verifyQuote("los créditos mayores a s/ 500,000 requieren aprobación del comité de riesgos", source)).toBe(true);
  });
  it("rejects a quote that is not in the document", () => {
    expect(verifyQuote("Los créditos mayores a S/ 100,000 requieren aprobación del Directorio", source)).toBe(false);
  });
  it("accepts segments joined by ellipsis only if all exist", () => {
    expect(verifyQuote("Los créditos mayores a S/ 500,000 … aprobación del Comité de Riesgos", source)).toBe(true);
    expect(verifyQuote("Los créditos mayores a S/ 500,000 … aprobación del Directorio general", source)).toBe(false);
  });
  it("rejects empty quotes", () => {
    expect(verifyQuote("", source)).toBe(false);
    expect(verifyQuote(null, source)).toBe(false);
  });
});

describe("resolveFindingStatus", () => {
  it("downgrades unverified findings to sin_evidencia", () => {
    expect(resolveFindingStatus("cumple", false)).toBe("sin_evidencia");
    expect(resolveFindingStatus("riesgo", true)).toBe("riesgo");
  });
});

import { describe, expect, it } from "vitest";
import { validateUpload, storageFileName } from "./uploads";

describe("Carga de cualquier formato documental", () => {
  it.each(["caso.pdf", "caso.doc", "caso.docx", "caso.xls", "caso.xlsx", "caso.csv", "caso.odt", "caso.zip", "sin-extension"])("admite %s sin inventar restricciones por extensión", (name) => {
    expect(() => validateUpload({ name, size: 10 })).not.toThrow();
  });
  it("conserva una ruta segura para nombres con acentos y separadores", () => {
    expect(storageFileName("../Resolución número 1.pdf")).toBe(".._Resolucio_n_nu_mero_1.pdf");
  });
  it("rechaza nombres vacíos y tamaños inválidos", () => {
    expect(() => validateUpload({ name: "", size: 10 })).toThrow();
    expect(() => validateUpload({ name: "caso.pdf", size: -1 })).toThrow();
  });
});
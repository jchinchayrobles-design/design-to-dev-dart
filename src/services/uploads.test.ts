import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  getUser: vi.fn(), upload: vi.fn(), remove: vi.fn(), insert: vi.fn(), single: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: mock.getUser },
  storage: { from: () => ({ upload: mock.upload, remove: mock.remove }) },
  from: () => ({ insert: mock.insert }),
} }));
vi.mock("@/integrations/lovable", () => ({ lovable: { auth: {} } }));
import { services } from "./index";

describe("Confirmaciones reales de guardado", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.clearAllMocks();
    mock.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    mock.insert.mockReturnValue({ select: () => ({ single: mock.single }) });
    mock.remove.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("confirma solo después de guardar el archivo y sus metadatos sin inventar vigencia", async () => {
    mock.upload.mockResolvedValue({ error: null });
    mock.single.mockResolvedValue({ data: { id: "id", file_name: "norma.odt", created_at: "2026-10-17T00:00:00Z" }, error: null });
    const result = await services.uploadDocument(new File(["contenido"], "norma.odt"));
    expect(mock.upload).toHaveBeenCalledTimes(1);
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ file_name: "norma.odt", user_id: "owner", file_size: 9 }));
    expect(result.title).toBe("norma.odt");
    expect(result.versions).toEqual([]);
    expect(result.pendingValidation).toBe(true);
  });
  it("no registra éxito cuando el almacenamiento falla", async () => {
    mock.upload.mockResolvedValue({ error: { message: "network failure" } });
    await expect(services.uploadDocument(new File(["x"], "norma.pdf"))).rejects.toThrow("No se pudo guardar");
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it("elimina el archivo si falla su registro en la biblioteca", async () => {
    mock.upload.mockResolvedValue({ error: null });
    mock.single.mockResolvedValue({ data: null, error: { message: "failed" } });
    await expect(services.uploadDocument(new File(["x"], "norma.xlsx"))).rejects.toThrow("No se pudo registrar");
    expect(mock.remove).toHaveBeenCalledWith([expect.stringMatching(/^owner\//)]);
  });
  it("no carga documentos sin una cuenta autenticada", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(services.uploadDocument(new File(["x"], "norma.docx"))).rejects.toThrow("Inicia sesión");
    expect(mock.upload).not.toHaveBeenCalled();
  });
});
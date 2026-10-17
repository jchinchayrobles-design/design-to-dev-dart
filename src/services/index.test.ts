import { describe, expect, it } from "vitest";
import { services } from "./index";

describe("Real data only", () => {
  it("returns no sample documents without a session", async () => {
    expect(await services.listDocuments()).toEqual([]);
    expect(await services.getDocument("POL-RC-002")).toBeNull();
  });
  it("returns no simulated validation findings", async () => {
    expect(await services.runValidations()).toEqual([]);
  });
  it("does not invent answers or emit progress without a session", async () => {
    const stages: string[] = [];
    await expect(services.askQuestion("vigencia y límites", (stage) => stages.push(stage))).rejects.toThrow("Inicia sesión");
    expect(stages).toEqual([]);
  });
  it("requires a session before reporting an upload as successful", async () => {
    await expect(services.uploadDocument(new File(["caso"], "caso.txt"))).rejects.toThrow("Inicia sesión");
  });
});

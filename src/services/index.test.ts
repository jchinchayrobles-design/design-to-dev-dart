import { describe, expect, it } from "vitest";
import { NotImplementedError, services } from "./index";

describe("Real data only", () => {
  it("returns no sample documents", async () => {
    expect(await services.listDocuments()).toEqual([]);
    expect(await services.getDocument("POL-RC-002")).toBeNull();
  });
  it("returns no simulated validation findings", async () => {
    expect(await services.runValidations()).toEqual([]);
  });
  it("does not invent answers or emit simulated progress", async () => {
    const stages: string[] = [];
    await expect(services.askQuestion("vigencia y límites", (stage) => stages.push(stage))).rejects.toBeInstanceOf(NotImplementedError);
    expect(stages).toEqual([]);
  });
  it("does not report an upload or processing as successful", async () => {
    await expect(services.uploadDocument(new File(["caso"], "caso.txt"))).rejects.toBeInstanceOf(NotImplementedError);
    expect((await services.getProcessingStatus("caso")).stage).toBe("no_disponible");
  });
});
import { describe, expect, it } from "vitest";
import { assessValidity } from "./validity";
import type { DocumentVersion, NormativeDocument } from "./types";

// Minimal test inputs, never imported by the application.
const version = (v: string, status: DocumentVersion["status"], from: string | null): DocumentVersion => ({
  v, status, from, until: null, approved: null, by: null, note: "",
});
const doc = (versions: DocumentVersion[]): NormativeDocument => ({
  id: "test", code: "test", title: "", type: "", area: "", owner: "", description: "",
  versions, relations: [], classification: "", uploaded: null, review: "",
});
const DATE = "2026-10-17";

describe("assessValidity", () => {
  it("picks the approved version, not a replaced version", () => {
    const a = assessValidity(doc([version("2.0", "replaced", "2025-01-01"), version("3.0", "approved", "2026-09-15")]), DATE);
    expect(a.state).toBe("Vigente");
    expect(a.version?.v).toBe("3.0");
  });
  it("keeps the current version applicable while a later one is future", () => {
    const a = assessValidity(doc([version("2.0", "approved", "2025-01-01"), version("3.0", "approved", "2026-12-01")]), DATE);
    expect(a.version?.v).toBe("2.0");
    expect(a.futureVersion?.v).toBe("3.0");
  });
  it("never concludes vigencia for a pending document", () => {
    const a = assessValidity(doc([version("1.0", "pending", "2026-01-01")]), DATE);
    expect(a.state).toBe("Pendiente");
    expect(a.version).toBeNull();
  });
  it("flags approved version without dates as uncertain", () => {
    const a = assessValidity(doc([version("1.0", "approved", null)]), DATE);
    expect(a.state).toBe("Revisión");
    expect(a.uncertain).toBe(true);
  });
});

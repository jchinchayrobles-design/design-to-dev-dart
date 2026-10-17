/** Storage accepts any format; validity and content analysis are separate steps. */
export function validateUpload(file: { name: string; size: number }) {
  if (!file.name.trim() || file.name.length > 1024) throw new Error("El nombre del archivo no es válido.");
  if (!Number.isSafeInteger(file.size) || file.size < 0) throw new Error("El tamaño del archivo no es válido.");
}

export function storageFileName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "documento";
}
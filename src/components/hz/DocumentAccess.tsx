import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { services } from "@/services";
import { Button } from "@/components/ui/button";

export function DocumentAccess() {
  const { data: signedIn } = useQuery({ queryKey: ["identity"], queryFn: services.isSignedIn });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (signedIn !== false) return null;
  const login = async (provider: "google" | "lovable") => {
    setBusy(true); setError("");
    try { await services.signIn(provider); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo iniciar sesión."); }
    finally { setBusy(false); }
  };
  return (
    <div className="my-3 space-y-2 border-y border-border py-3">
      <p className="flex items-center gap-2 text-[12px] text-muted-foreground"><LockKeyhole className="size-4 shrink-0" />Inicia sesión para guardar y consultar tus documentos privados.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void login("google")}>Continuar con Google</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void login("lovable")}>Continuar con Lovable</Button>
      </div>
      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
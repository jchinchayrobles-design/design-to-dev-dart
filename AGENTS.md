<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- UI calls only `src/services` (HorizonteServices); implement real providers behind this contract without coupling components to storage.
- Document files and metadata are private and owner-scoped through Lovable Cloud RLS; the browser provider handles storage only inside service methods so UI remains decoupled and SSR never reads private data.
- Document text is extracted in the browser at upload; AI contrast runs in an authenticated server function and every citation is verified literally against stored text (unverified findings become "sin_evidencia"), preventing invented conclusions. Validity is never inferred.
- Any file extension can be stored; upload confirmation requires both storage and metadata success, with cleanup on registration failure to avoid false confirmations.
- Validity/validation rules live in `src/lib/domain` as pure functions with tests, so they can be reused server-side.

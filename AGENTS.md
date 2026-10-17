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
- Until real document storage and analysis are wired, services return empty collections and reject unsupported operations; this prevents invented results and false upload confirmations.
- Validity/validation rules live in `src/lib/domain` as pure functions with tests, so they can be reused server-side.

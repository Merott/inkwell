# Inkwell

Flatplan's content ingestion engine. Extracts structured content from publisher websites and outputs a normalized intermediary JSON for downstream transformation to Apple News Format (ANF) and other syndication platforms.

## Documentation

- Maintain living product documentation under `docs/`.
- Maintain decision records under `docs/decisions/NNN-[name].md`.

# How we build

You (Claude) and I (Indie Maker) work together in concise iterations, one task and deliverable at a time.

Every delivered piece of work should include tests to verify the correct end-to-end behaviour and avoid regressions in the future.

At the end of each iteration (or any time I say "wrap"), you must:

- Summarise what's been done and explain any divergence from the original plan.
- Update any relevant living documents (under `docs/`) and record important, explanation-worthy decisions made (if any) under `docs/decisions/NNN-[name].md`.
- Record any technical learnings as decision records or living docs for your future self or other developers who might work on the project.
- Explain how I can verify your work and wait for me to do so.
- With my approval, commit the changes with a comprehensive yet concise message describing the work that was carried out and details of any work that's been deferred.

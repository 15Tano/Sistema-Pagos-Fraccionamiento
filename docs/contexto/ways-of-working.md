# Ways Of Working

Last updated: Sep 15, 2026

## Summary

How San Isidro 2.0 work is run — design-first flow, patch style, command expectations, commit and debug workflows.

## Details

- Design before code: propose the full conceptual design and confirm assumptions before writing any implementation, especially for multi-component features.
- Diagnostic before coding: for refactors and bug fixes, audit first (bugs, structure, UX), confirm each finding, then build in dependency order.
- Targeted patches over rewrites: Kanye explicitly prefers exact minimal diffs — isolate only what changes and leave surrounding code untouched.
- Real code before proposals: never invent column names, endpoints, or structure — always read actual files before proposing changes; use str_replace with exact multi-line anchors, and always git pull and read the current file before editing.
- Step-by-step with exact commands: Kanye prefers explicit PowerShell/bash commands at each stage, with an explanation of what each step does before proceeding.
- Cautious deploys with confirmation gates: never one-shot automated operations for production; always preview changes and confirm before applying.
- Iterative UI feedback: UI goes through multiple rounds with direct, specific per-round requirements, and feedback is expected to be incorporated precisely.
- Backend debugging flow: Network tab → grep ERROR laravel.log → tinker for direct model testing.
- Commits: explicit per-file git add with exact paths from git status output; local branch refactor-headless-final tracks origin/refactor-headless; pushes use `git push origin HEAD:refactor-headless`.

## Uso de este documento

Preferencias de trabajo proporcionadas por el usuario, registradas al 15 de septiembre de 2026. Verificar la rama, su seguimiento remoto y el estado del árbol de trabajo antes de aplicar instrucciones de Git. Las instrucciones actuales del usuario prevalecen cuando actualicen estas preferencias.

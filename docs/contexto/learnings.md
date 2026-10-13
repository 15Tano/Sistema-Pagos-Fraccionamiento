# Learnings

Last updated: Sep 15, 2026

## Summary

Hard-won technical learnings for San Isidro 2.0 — deploy/git discipline, CSS, React, integrations, security.

## Principles

- Backend enforcement over frontend trust: access restrictions (corte de caja block, time-restricted capturista login) must be enforced at the API level, not just visually in the frontend.
- Timezone handling: always use Carbon explicitly; define timezone at the framework level rather than assuming server defaults.
- Recalculate, don't trust cached values: on any reopen/recalculation (e.g. corte de caja monto_sistema), recompute from source data rather than using previously saved figures.

## Git & deploy

- Git discipline hard-learned: months of direct nano-over-SSH edits caused significant repo drift; all changes now go via git pull + rsync deploy script — never edit production files directly.
- Deploy safety pattern: always test deploy to a separate path using real .env and verify real endpoints before touching production; use confirmation gates in deploy scripts.
- Monorepo structural mismatch: repo has backend code under backend/ while the droplet runs Laravel flat at docroot root; rsync bridges this — never use `git reset --hard` directly on the docroot.
- .gitignore anchoring: rules prefixed with / anchor to repo root and don't apply inside subdirectories like backend/; use `backend/vendor` explicitly or remove the leading /.

## CSS

- border-image ignores border-radius — use a ::before pseudo-element with background: linear-gradient plus overflow-hidden instead.
- backdrop-filter breaks when the element is a descendant of a parent with backdrop-filter applied — use createPortal to document.body for modals.
- // comments are invalid CSS and break lightningcss builds.

## React

- Never call data-fetching functions directly in the render body — use useEffect.
- Initialize loading state to false when useEffect has a guard condition checking !loading.
- Use AbortController for search inputs to cancel in-flight requests on each keystroke.

## Integrations

- OneSignal race condition: OneSignal.login() must always await initPromise before executing — calling it before init() fully resolves causes corrupted empty-token subscriptions, which must then be deleted individually via the OneSignal REST API.
- ZKTeco expiration logic: acc_startdate fixed permanently at 2020-01-01; acc_enddate set to the cutoff day of the month following the last consecutive paid month (per-month DIAS_VENCIMIENTO map), or 2020-01-02 for expired users (ensures start < end).
- Carbon object mutation bug: $currentDate->addMonth() mutates the original — use immutable copies.

## Security

- Never log $request->all() in production — plaintext passwords end up in laravel.log; rotate affected passwords and archive (don't delete) the log for audit purposes.

## iOS PWA

- border-radius plus negative-offset absolute elements outside a parent with overflow-hidden causes Safari to scale down the layout.
- Use min-h-dvh, not min-h-screen.
- The theme-color meta tag controls the iOS standalone status bar color.

## Uso de este documento

Aprendizajes proporcionados por el usuario, registrados al 15 de septiembre de 2026. Conservar las reglas del proyecto y verificar las observaciones técnicas contra el código y el entorno actuales al aplicarlas.

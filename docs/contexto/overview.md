Overview
Last updated
Sep 27, 2026
Summary

San Isidro 2.0 PWA — purpose, stack, architecture, design system, and current state of active work

Details
Purpose & context
Kanye (Sebastián Espinoza Díaz, eltano193@gmail.com) is a freelance software engineering student in Hidalgo, México
San Isidro 2.0 is a formally contracted, paid PWA for a gated residential community of ~350 residents
The system manages resident payments, vehicular access control, and community communications
User roles: admin, capturistas (payment data entry operators), vigilancia (security guards), residents
Key people: community committee (client/stakeholders); 4 capturistas with time-restricted access; ~350 residents as end users
Resident adoption is an ongoing challenge
Stack & infrastructure
Frontend: React 18 + Vite 7 + Tailwind CSS v4 (@tailwindcss/vite) + Zustand, deployed on Vercel at sanisidro.info
Frontend libs: Axios, React Router v7, lucide-react, react-onesignal
Backend: Laravel 12 + MySQL + Sanctum Bearer Tokens, on a DigitalOcean droplet via CloudPanel/Nginx at api.sanisidro.info
Backend libs: Carbon, Eloquent Observers; PHP 8.4-FPM
Monorepo at 15Tano/Sistema-Pagos-Fraccionamiento on GitHub, production branch refactor-headless
Local dev: XAMPP on Windows (PowerShell), php artisan serve
Hardware integration: ZKTeco C3 access panel, ZKAccess 3.5, synchronized via conexionzk.py (Python + pyodbc connecting to Access MDB)
Push notifications: OneSignal (App ID 81ce07fe-42b0-48cb-9d49-04b92535538e), tag filter rol = residente for broadcast
JSX syntax validation without full install: npx --yes esbuild [file] --bundle=false --outfile=/tmp/out.js from within frontend/
Design system
"Premium Liquid Glass" / glassmorphism: warm background
#f5f4f2, orange radial gradient blobs, backdrop-filter cards, dark carbon text, orange (
#f97316) accent
Global CSS classes live in index.css (.glass-card, .glass-card-lg, .app-shell, .badge-*)
Seasonal theming via body[data-tema="septiembre"], layered additively without touching existing Tailwind utility classes
Frontend architecture pattern
Complex pages use pages/[PageName]/index.jsx orchestrator + hooks/ + components/ subdirectory; this pattern is established and must be followed for all new pages
API calls use an api/[resource].js Axios wrapper pattern
Current state
Deploy pipeline: git reconciliation fully complete on refactor-headless, commit ccab4c0
Droplet syncs via rsync from /root/repo-sanisidro (cloned outside docroot) to /home/sanisidro-back/htdocs/api.sanisidro.info/
Abandoned .git in docroot moved to .git.OLD-abandonado-abril
Reusable deploy script at /root/deploy-sanisidro.sh automates git pull, backup, migration diff check, rsync, composer, cache clear, migrations, permissions, PHP-FPM reload, HTTP verify
Frontend-only changes deploy automatically via Vercel on push; the deploy script is only needed for backend changes
Corte de caja: full design finalized, real schema researched in-repo, migration drafted — see corte-caja for complete detail (this is one of the biggest features built for San Isidro so far, per Kanye)
Historico.jsx refactor fully completed and delivered as a new folder-based structure matching the established page pattern; old flat Historico.jsx must be deleted/renamed to avoid Vite bundler conflicts
VenderTagButton implemented at frontend/src/pages/Pagos/components/VenderTagButton.jsx — fixed right-side tab with spring-animation sliding drawer containing SellTagPanel; two bugs fixed (render-body fetchData call, loading initialized to true)
September seasonal theming core system working: papel picado franja, tricolor card border-top (.card-tematizable), saludo patrio in DashboardHeader.jsx, blob glow colors
TemporadaProvider.jsx sets document.body.dataset.tema and mounts decorative components
DestellosEntrada animation shows once per day plus on every explicit page reload, using a localStorage date key + performance.getEntriesByType("navigation")[0].type === "reload"
Sombrero on semáforo is paused pending a redesign decision
Decision: the capturista role should only have the Pagos, Vecinos and Tags windows available in the UI
On the horizon
Capturista time-restriction middleware (horario.cobro) created but not registered in bootstrap/app.php or applied to routes; remaining steps: add alias, wrap tag_sales/pagos routes, confirm vecinos route scope, clear config/route cache
Admin panel grid for capturista schedules (12 months × 4 capturistas, annual batch upsert) pending
Tag search bug in vigilancia panel is a pre-existing known issue, deferred
QR guest access module designed and documented for the community committee: single-use, expires end of day, push notification on entry, guard scans via phone camera; not implemented, pending client approval and possible separate billing discussion
Sombrero semáforo redesign: two options proposed (refined SVG proportions vs. banderita/pin), decision pending
Admin dashboard panel drag-and-drop planned but not started; dnd-kit recommended (@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities) with Zustand + localStorage for persistence
Competitive features identified as high-value/low-effort: visit logs with guard-captured photos, panic button, emergency phone directory, amenities calendar, CSV export
Deferred maintenance: APP_KEY rotation (deferred to avoid forcing logouts on less tech-savvy residents, to be done in scheduled maintenance)
Deferred maintenance: .env copy on droplet with loose permissions (low risk, not corrected); garbage file php artisan tinker in droplet root (harmless, left); old backend/ folder from April in droplet root (not Nginx-exposed, left)
Deferred maintenance: npm audit fix for 8 frontend vulnerabilities including prototype pollution in axios (not retaken)

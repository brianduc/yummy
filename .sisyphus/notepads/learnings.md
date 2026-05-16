- T11: Refactored `Button` to Tailwind semantic tokens cleanly, changing `font-mono` to `font-sans`.
- Wave 4 semantic primitives need token parity across `globals.css` and `tailwind.config.js`; add aliases in both places to keep utility names and CSS vars aligned.
- T23: Radix Avatar wrapper follows the same compound pattern as ScrollArea; `AvatarFallback` only renders inside `Avatar`, and tests should cover the wrapper rather than standalone fallback usage.
- T26: `frontend/lib/utils.ts` already exposes `cn()` via `clsx` + `tailwind-merge`; skeleton can stay minimal and rely on that merge helper.
## 2026-05-14
- Radix separator wrapper follows the same forwardRef pattern as other ui primitives: default `decorative=true`, base `shrink-0 bg-border`, and orientation-specific sizing classes.
- Frontend Vitest suite currently has unrelated failing avatar tests; separator component tests pass.
## 2026-05-14 T49
- Default theme now flips to `kinetic-light` when saved theme is missing or invalid.
- Added regression tests for empty storage, saved override, and invalid fallback.

## F3 QA Run — 2026-05-14
- Vitest 421/421 pass, 48 files — all green
- Next.js 16.2.3 Turbopack build exits 0, TypeScript clean
- Dev server /workspace/[sessionId] returns 200; data-theme is CSR-applied (not in SSR HTML)
- ALL_THEME_IDS has 8 entries; parametrized over 9 KEY_PANELS = 72 cases
- Total gzipped JS ~291 KB (980 KB raw) — reasonable for 24-panel platform
- Evidence at: .sisyphus/evidence/final-qa/
- F2 review fix: `AICopilot.tsx` no longer needs `as any` once the textarea ref and key handler are typed to `HTMLTextAreaElement`; `useWorkspaceStatus.ts` empty catches now document intentional retry-on-failure behavior.

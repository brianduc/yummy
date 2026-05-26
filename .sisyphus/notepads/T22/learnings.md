## 2026-05-26

- `activityItems` is the source of truth for the 13 workspace activity routes, so nav tests should assert the exact `data-testid` and `routeSuffix` pairs from `frontend/lib/workspace-navigation.ts`.
- Adding the 5 new nav routes exposed stale index-route expectations in unrelated characterization/header tests; the workspace index now resolves to the dashboard breadcrumb/shell, not the old IDE panel.
- `AppHeader` breadcrumb tests should follow `breadcrumbLabel` from the active activity item, which means the index route now expects `Dashboard`.

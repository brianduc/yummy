# Task 1 Sheet / UI Primitive Availability Evidence

## Local UI primitives

`frontend/components/ui/*.tsx` currently contains:

- `button.tsx` — present
- `dialog.tsx` — present
- `input.tsx` — present
- `scroll-area.tsx` — present
- `tabs.tsx` — present

Missing:

- `sheet.tsx` — not present
- `tooltip.tsx` — not present

## Copilot dependencies

`frontend/components/workspace/AICopilot.tsx` imports:

- `Button` from `@/components/ui/button`
- `Input` from `@/components/ui/input`
- `ScrollArea` from `@/components/ui/scroll-area`
- `mdToHtml` from `@/lib/mdToHtml`
- `useChat` from `@/hooks/useWorkspaceChat`
- `COMMANDS` from `./ChatPanel`
- lucide icons: `Send`, `Loader2`, `Zap`, `Bot`, `User`

## Provider mount point

`WorkspaceChatProvider` is defined in `frontend/hooks/useWorkspaceChat.tsx`.

It is currently mounted outside `WorkspaceLayout` in both:

- `frontend/app/workspace/[sessionId]/layout.tsx`
- `frontend/app/workspace/[sessionId]/page.tsx`

The refactor must preserve provider lifetime outside the future `CopilotSheet`. Do not mount `WorkspaceChatProvider` inside Sheet content.

## External docs

Radix Dialog supports `forceMount` on Portal / Overlay / Content. shadcn Sheet wraps Radix Dialog and normally forwards Radix props; actual local implementation must be checked/created because `frontend/components/ui/sheet.tsx` is missing.

Next.js App Router nested layouts persist across child route navigation, supporting the decision to make `frontend/app/workspace/[sessionId]/layout.tsx` the persistent shell owner.

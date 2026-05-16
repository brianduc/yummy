# start.sh / start.bat Mode Support

## TL;DR

> **Quick Summary**: Add `dev | staging | prod` mode support to `start.sh` and `start.bat`. Mode selected by CLI arg (default `dev`), loads `.env` then overlays `.env.<mode>`. `prod` mode is rejected from the launcher (use proper deploy). Frontend `NEXT_PUBLIC_API_URL` and a few other vars become per-mode configurable.
>
> **Deliverables**:
> - `start.sh` updated with mode arg parsing, validation, overlay loading, banner badge, prod refusal, --help
> - `start.bat` mirrored with same mode logic
> - `.env.dev.example`, `.env.staging.example`, `.env.prod.example` shipped (placeholder secrets only)
> - `.gitignore` updated to ignore `.env.dev`, `.env.staging`, `.env.prod`
> - `README.md` documents the mode flag and per-mode envs
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (example files + gitignore) → Task 2 (start.sh) || Task 3 (start.bat) → Task 4 (README) → F1-F4

---

## Context

### Original Request
> "i want the start.sh can be run with different mode, eg: if i run in dev mode, the script will set api variable in frontend env to an custom api endpoint defined by me,..."

### Interview Summary
**Key Discussions**:
- Mode selection: CLI argument (`bash start.sh dev`)
- Modes: `dev`, `staging`, `prod`
- Config source: `.env.<mode>` files overlaid on base `.env`
- Per-mode example files committed to repo; auto-copy to `.env.<mode>` on first run
- Default mode = `dev` (preserves current behavior)
- Mode badge shown in console banner
- Both `start.sh` and `start.bat` updated
- Mode-affected vars: `NEXT_PUBLIC_API_URL`, `BACKEND_PORT`, `FRONTEND_PORT`, `AI_PROVIDER` (+ Gemini/Ollama vars), `CORS_ORIGINS`
- `frontend/.env.local`: overwritten every run with mode-derived values
- Variable precedence: mode overrides base
- `prod` mode in launcher: REFUSED with helpful message (forces user to docker / proper deploy)
- Backend: NOT mode-aware (pure launcher concern)
- Tests: Agent-executed QA only (no Bats)

**Research Findings**:
- `start.sh:97` currently hardcodes `NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT` — this is the line to replace.
- `.gitignore` already ignores `.env` and `.env.local`. Does NOT ignore `.env.dev`/`.env.staging`/`.env.prod` — must be added.
- Existing `.env` auto-create pattern (`start.sh:18-28`): copy from `.env.example` if missing, prompt user, exit. Plan mirrors this pattern for mode files.

### Metis Review
**Identified Gaps** (addressed):
- frontend/.env.local lifecycle → resolved: overwrite every run.
- prod mode meaning → resolved: refused from launcher.
- Variable precedence → resolved: mode overrides base.
- Backend MODE awareness → resolved: launcher only.
- Help flag → addressed: `--help|-h|help` exits 0 with usage.
- Secret leakage → addressed: example files contain placeholders only; QA greps for real key patterns.
- .gitignore drift → addressed: explicit task to add `.env.dev|staging|prod` (not `.env.*` glob to keep examples tracked).
- start.sh ↔ start.bat parity → addressed via dedicated parity QA scenario.

---

## Work Objectives

### Core Objective
Make `start.sh` and `start.bat` mode-aware so developers can launch the stack against different environments (currently dev or staging) without manual `.env` editing or hand-writing `frontend/.env.local`.

### Concrete Deliverables
- Modified file: `start.sh`
- Modified file: `start.bat`
- New file: `.env.dev.example` (committed)
- New file: `.env.staging.example` (committed)
- New file: `.env.prod.example` (committed, but `prod` mode is refused by launcher)
- Modified file: `.gitignore` (add `.env.dev`, `.env.staging`, `.env.prod`)
- Modified file: `README.md` (mode usage section)

### Definition of Done
- [ ] `bash start.sh dev` starts both servers; `frontend/.env.local` contains the `NEXT_PUBLIC_API_URL` from `.env.dev`.
- [ ] `bash start.sh staging` does the same with staging values.
- [ ] `bash start.sh prod` exits non-zero with a helpful message; nothing is started.
- [ ] `bash start.sh foo` exits non-zero with `Unknown mode: foo. Allowed: dev, staging, prod`.
- [ ] `bash start.sh --help` exits 0 with usage text.
- [ ] `bash start.sh` (no arg) behaves identically to `bash start.sh dev`.
- [ ] First run of any mode auto-copies `.env.<mode>.example` → `.env.<mode>`, prints notice, continues (or asks for fill-in if secrets needed — same UX as current `.env` flow).
- [ ] `start.bat dev`, `start.bat staging`, `start.bat prod`, `start.bat foo`, `start.bat --help`, `start.bat` produce equivalent behavior on Windows.
- [ ] `git check-ignore .env.dev .env.staging .env.prod` exits 0; `git check-ignore .env.dev.example` exits 1.
- [ ] No real API keys appear in any `.env.*.example` file (regex-checked).
- [ ] Console banner shows `[<mode> mode]` for dev/staging.

### Must Have
- CLI arg `dev|staging|prod` parsed in both scripts.
- Whitelist validation BEFORE any file operations.
- `prod` rejected from launcher with message pointing to docker/proper deploy.
- `--help|-h|help` prints usage and exits 0.
- `.env` loaded first, `.env.<mode>` overlaid on top (mode wins).
- `frontend/.env.local` always written/overwritten with mode-derived `NEXT_PUBLIC_API_URL` (and any other `NEXT_PUBLIC_*` from `.env.<mode>` if simple to forward — see scope note).
- Mode badge in console banner.
- start.sh and start.bat in lockstep.
- `.env.<mode>.example` files committed; `.env.<mode>` files gitignored.

### Must NOT Have (Guardrails)
- NO refactoring unrelated parts of `start.sh` ("while we're here..." cleanup).
- NO config abstraction layer (no JSON, no Node wrapper, no extra config files).
- NO backend code changes. NO frontend code changes. NO `package.json` edits.
- NO `docker-compose.yml`, GitHub Actions, or CI changes.
- NO new modes beyond `dev|staging|prod`.
- NO real secrets in `.env.*.example` files (placeholders only: `your_gemini_key_here`).
- NO interactive prompts for mode selection (CLI arg only).
- NO Bats / shell test framework introduction.
- NO `MODE` env var exported to backend.
- NO schema validation of `.env.<mode>` contents.
- NO change to `frontend/.env.local` write semantics other than the value source (still overwritten every run).
- NO touching the legacy `backend/` (Python) or any Python files.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO (no shell test framework)
- **Automated tests**: NONE (per user decision)
- **Framework**: N/A
- **Verification**: Agent-executed QA scenarios only — see each TODO and Final Verification Wave.

### QA Policy
Every task includes agent-executed QA scenarios with concrete commands and assertions.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Shell scripts**: `interactive_bash` (tmux) — run script, capture output via `tee`, kill bg processes, grep stdout/files
- **File assertions**: `Bash` — `diff`, `grep -Fxq`, `git check-ignore`, regex grep for secret patterns
- **Windows batch**: Static-diff review by agent comparing start.bat mode-handling block against start.sh; documented in QA evidence (no Windows runner available locally)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - parallel):
├── Task 1: .env.<mode>.example files + .gitignore [quick]

Wave 2 (Script changes - parallel):
├── Task 2: start.sh mode logic [unspecified-high]   (depends: 1)
└── Task 3: start.bat mode logic [unspecified-high]  (depends: 1)

Wave 3 (Docs):
└── Task 4: README mode docs [writing]               (depends: 2, 3)

Wave FINAL (4 parallel reviews):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA - mode matrix (unspecified-high)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

- **1**: depends on — | blocks 2, 3
- **2**: depends on 1 | blocks 4, F1-F4
- **3**: depends on 1 | blocks 4, F1-F4
- **4**: depends on 2, 3 | blocks F1-F4
- **F1-F4**: depends on 1-4 | blocks user okay

### Agent Dispatch Summary

- **Wave 1**: T1 → `quick`
- **Wave 2**: T2 → `unspecified-high`, T3 → `unspecified-high`
- **Wave 3**: T4 → `writing`
- **Wave FINAL**: F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Create `.env.<mode>.example` files and update `.gitignore`

  **What to do**:
  - Create `.env.dev.example` at repo root with mode-specific defaults:
    ```
    # YUMMY - dev mode overrides (loaded on top of .env)
    NEXT_PUBLIC_API_URL=http://localhost:8000
    BACKEND_PORT=8000
    FRONTEND_PORT=3000
    AI_PROVIDER=gemini
    GEMINI_API_KEY=your_gemini_key_here
    OLLAMA_BASE_URL=http://localhost:11434
    OLLAMA_MODEL=codellama
    CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
    ```
  - Create `.env.staging.example` with staging-style placeholders:
    ```
    # YUMMY - staging mode overrides (loaded on top of .env)
    NEXT_PUBLIC_API_URL=https://staging-api.example.com
    BACKEND_PORT=8000
    FRONTEND_PORT=3000
    AI_PROVIDER=gemini
    GEMINI_API_KEY=your_gemini_key_here
    OLLAMA_BASE_URL=http://localhost:11434
    OLLAMA_MODEL=codellama
    CORS_ORIGINS=https://staging-app.example.com
    ```
  - Create `.env.prod.example` with prod-style placeholders (file exists for documentation; launcher refuses prod mode):
    ```
    # YUMMY - prod mode overrides
    # NOTE: start.sh / start.bat refuse to run prod mode.
    #       Use docker compose or your real deployment pipeline.
    NEXT_PUBLIC_API_URL=https://api.example.com
    BACKEND_PORT=8000
    FRONTEND_PORT=3000
    AI_PROVIDER=gemini
    GEMINI_API_KEY=your_gemini_key_here
    CORS_ORIGINS=https://app.example.com
    ```
  - Update `.gitignore`: add three lines under the `# Environment` block (after existing `.env.local`):
    ```
    .env.dev
    .env.staging
    .env.prod
    ```
  - Do NOT change existing `.env` / `.env.local` rules.
  - Do NOT use a `.env.*` glob — that would also ignore the example files.

  **Must NOT do**:
  - Do not put any real API key in any example file. Use literal `your_*_here` placeholders.
  - Do not modify `.env.example` (the existing base template).
  - Do not create `.env.dev`, `.env.staging`, `.env.prod` themselves — only the `.example` versions.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Three small new files + one tiny `.gitignore` edit. Zero logic.
  - **Skills**: []
    - No domain skill needed.

  **Parallelization**:
  - **Can Run In Parallel**: NO (foundation for tasks 2 and 3)
  - **Parallel Group**: Wave 1 (sole task)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None — can start immediately

  **References**:

  **Pattern References**:
  - `/.env.example` — existing template format to mirror (variable names, comment style)
  - `/.gitignore:1-3` — existing `# Environment` block where new lines go

  **Test References**:
  - None (no test framework)

  **External References**:
  - None

  **WHY Each Reference Matters**:
  - `.env.example` defines canonical variable names (e.g. `NEXT_PUBLIC_API_URL`, not `NEXT_PUBLIC_API`); the new example files must use exactly those names so overlay loading matches.
  - `.gitignore` placement matters — keep the new entries grouped under the existing `# Environment` comment for discoverability.

  **Acceptance Criteria**:
  - [ ] `test -f .env.dev.example && test -f .env.staging.example && test -f .env.prod.example` → exit 0
  - [ ] `grep -q '^NEXT_PUBLIC_API_URL=http://localhost:8000$' .env.dev.example` → exit 0
  - [ ] `grep -q '^NEXT_PUBLIC_API_URL=https://' .env.staging.example` → exit 0
  - [ ] `! grep -E 'AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36}' .env.dev.example .env.staging.example .env.prod.example` → exit 0
  - [ ] `git check-ignore -q .env.dev .env.staging .env.prod` → exit 0
  - [ ] `git check-ignore -q .env.dev.example` → exit 1 (NOT ignored)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Example files exist with correct shape
    Tool: Bash
    Preconditions: Repo root, prior tasks not started
    Steps:
      1. Run `ls .env.dev.example .env.staging.example .env.prod.example`
      2. Run `grep -c '^[A-Z_]\+=' .env.dev.example` — expect at least 7 KEY=VALUE lines
      3. Run `grep -c '^[A-Z_]\+=' .env.staging.example` — expect at least 7
      4. Run `grep -c '^[A-Z_]\+=' .env.prod.example` — expect at least 5
    Expected Result: All three files listed; line counts match.
    Failure Indicators: Any file missing; KEY=VALUE count < threshold.
    Evidence: .sisyphus/evidence/task-1-files-exist.txt (capture stdout of all 4 commands)

  Scenario: No real secrets in example files
    Tool: Bash
    Preconditions: Three example files created
    Steps:
      1. Run `grep -rE 'AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36}' .env.*.example` — expect exit 1 (no match)
      2. Run `grep -E '=your_[a-z_]+_here$' .env.dev.example` — expect at least 1 match (placeholder pattern present)
    Expected Result: Zero real-key matches; placeholder pattern present.
    Failure Indicators: Any regex match for real-looking key; no placeholders.
    Evidence: .sisyphus/evidence/task-1-secret-scan.txt

  Scenario: .gitignore behavior correct
    Tool: Bash
    Preconditions: .gitignore updated
    Steps:
      1. Run `git check-ignore -v .env.dev .env.staging .env.prod` — expect all three printed (exit 0)
      2. Run `git check-ignore -v .env.dev.example` — expect exit 1 (not ignored)
      3. Run `git check-ignore -v .env.example` — expect exit 1 (still not ignored)
    Expected Result: Exact ignore behavior as specified.
    Failure Indicators: Example files ignored, OR mode files not ignored.
    Evidence: .sisyphus/evidence/task-1-gitignore-check.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-1-files-exist.txt`
  - [ ] `.sisyphus/evidence/task-1-secret-scan.txt`
  - [ ] `.sisyphus/evidence/task-1-gitignore-check.txt`

  **Commit**: NO (groups with all other tasks in single commit)

- [x] 2. Add mode support to `start.sh`

  **What to do**:
  Modify `start.sh` to accept a mode argument and load `.env.<mode>` overlay.
  Implement these changes IN ORDER, in `start.sh`:

  1. **Argument parsing block** (immediately after the color-code line, before `.env` auto-create):
     - Read `$1` as `MODE_ARG`.
     - If `MODE_ARG` is `--help`, `-h`, or `help`: print usage block and `exit 0`. Usage must include:
       ```
       Usage: bash start.sh [mode]
         mode: dev (default) | staging | prod

         dev      Load .env then .env.dev. Start backend + frontend locally.
         staging  Load .env then .env.staging. Start backend + frontend locally.
         prod     REFUSED. Use docker compose or your real deploy pipeline.

         No mode argument is equivalent to 'dev'.
       ```
     - If `MODE_ARG` is empty, set `MODE=dev`.
     - Else if `MODE_ARG` is `dev`, `staging`, or `prod`: set `MODE="$MODE_ARG"`.
     - Else: print `ERROR: Unknown mode: $MODE_ARG. Allowed: dev, staging, prod` (red) and `exit 1`.
     - If `MODE` is `prod`: print `ERROR: prod mode is not for local launchers. Use docker compose or your real deploy pipeline.` (red) and `exit 1`.

  2. **Mode example auto-create** (after base `.env` auto-create block, before `Load .env`):
     - If `.env.$MODE` does not exist:
       - If `.env.$MODE.example` exists: copy it to `.env.$MODE`, print yellow notice `Created .env.$MODE from .env.$MODE.example. Edit it if needed, then run again.` and `exit 0`.
       - Else: print red `ERROR: .env.$MODE not found and .env.$MODE.example missing.` and `exit 1`.

  3. **Mode overlay load** (modify the existing `set -a; source "$ROOT_DIR/.env"; set +a` block):
     ```bash
     set -a
     source "$ROOT_DIR/.env"
     [ -f "$ROOT_DIR/.env.$MODE" ] && source "$ROOT_DIR/.env.$MODE"
     set +a
     ```
     This guarantees mode overrides base.

  4. **Banner update**:
     - Replace `${CYAN}YUMMY - AI SDLC Platform${NC}` with `${CYAN}YUMMY - AI SDLC Platform ${YELLOW}[$MODE mode]${NC}`.

  5. **frontend/.env.local writing** (line 97):
     - Replace the hardcoded `echo "NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT" > .env.local`
       with `echo "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL" > .env.local`.
     - Rationale: after overlay, `$NEXT_PUBLIC_API_URL` already holds the right value (from `.env` or `.env.$MODE`).
     - Add a fallback: `: "${NEXT_PUBLIC_API_URL:=http://localhost:$BACKEND_PORT}"` immediately before the echo, so if neither `.env` nor `.env.$MODE` set it, behavior matches today.

  6. **No other changes**. Do not refactor unrelated code (cleanup function, dependency installs, port detection, etc.).

  **Must NOT do**:
  - Do not export `MODE` to backend env (`PORT="$BACKEND_PORT" pnpm dev` line stays as-is — do NOT add `MODE=$MODE`).
  - Do not change the cleanup trap, the pnpm install logic, the db:migrate call, or any color codes.
  - Do not introduce `getopts` or other arg parsers — keep the `case` statement minimal.
  - Do not source any file that doesn't exist (always guard with `[ -f ... ]`).
  - Do not modify `start.sh`'s shebang or top comment block beyond updating the `Usage:` line to mention `[mode]`.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Touches a critical bootstrap script with multiple edit points and ordering constraints. Wrong ordering breaks dev workflow for the whole team.
  - **Skills**: []
    - Pure shell editing; no domain skill matches more than general competence.

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3, which edits a different file)
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 4, F1-F4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `start.sh:11-15` — `ROOT_DIR` setup + color codes (already used; reuse `RED`/`YELLOW`/`CYAN`/`NC`)
  - `start.sh:18-28` — existing `.env` auto-create-from-example pattern (mirror exactly for `.env.$MODE`)
  - `start.sh:31-33` — existing `set -a; source ...; set +a` block (the one to modify)
  - `start.sh:39-42` — existing required-env-var validation pattern (red error + exit 1)
  - `start.sh:44-46` — existing banner echo block (the one to modify)
  - `start.sh:97` — the hardcoded `frontend/.env.local` write (the line to modify)
  - `start.sh:121-128` — cleanup trap (DO NOT TOUCH; reference for "what not to break")

  **WHY Each Reference Matters**:
  - The existing `.env` auto-create at lines 18-28 is the canonical pattern; copy its structure (yellow notice + exit 0) for the mode-file equivalent so UX is consistent.
  - Lines 31-33 are the load block — only swap source contents, do NOT change `set -a` discipline.
  - Line 97 is THE line user's request hinges on. Be surgical.

  **Acceptance Criteria**:
  - [ ] `bash -n start.sh` → exit 0 (syntax valid)
  - [ ] `bash start.sh --help` → exit 0, stdout contains literal `Usage: bash start.sh [mode]`
  - [ ] `bash start.sh -h` → exit 0, same usage
  - [ ] `bash start.sh help` → exit 0, same usage
  - [ ] `bash start.sh foo 2>&1 | grep -q 'Unknown mode: foo'` → exit 0
  - [ ] `bash start.sh foo; [ $? -ne 0 ]` → exit 0 (script exited non-zero)
  - [ ] `bash start.sh prod 2>&1 | grep -qi 'prod mode is not for local launchers'` → exit 0
  - [ ] `bash start.sh prod; [ $? -ne 0 ]` → exit 0 (script exited non-zero)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Default mode is dev
    Tool: interactive_bash (tmux)
    Preconditions: .env exists, .env.dev exists with NEXT_PUBLIC_API_URL=http://localhost:8000
    Steps:
      1. tmux new-session -d -s qa1 'bash start.sh 2>&1 | tee /tmp/qa1.log'
      2. sleep 6
      3. tmux send-keys -t qa1 C-c ; sleep 2 ; tmux kill-session -t qa1
      4. grep -F '[dev mode]' /tmp/qa1.log
      5. grep -Fxq 'NEXT_PUBLIC_API_URL=http://localhost:8000' frontend/.env.local
    Expected Result: Banner shows [dev mode]; frontend/.env.local has dev URL.
    Failure Indicators: Banner missing mode badge; frontend env empty or wrong URL.
    Evidence: .sisyphus/evidence/task-2-default-dev.log

  Scenario: Staging mode loads .env.staging
    Tool: interactive_bash (tmux)
    Preconditions: .env.staging contains NEXT_PUBLIC_API_URL=https://staging-api.example.com
    Steps:
      1. tmux new-session -d -s qa2 'bash start.sh staging 2>&1 | tee /tmp/qa2.log'
      2. sleep 6
      3. tmux send-keys -t qa2 C-c ; sleep 2 ; tmux kill-session -t qa2
      4. grep -F '[staging mode]' /tmp/qa2.log
      5. grep -Fxq 'NEXT_PUBLIC_API_URL=https://staging-api.example.com' frontend/.env.local
    Expected Result: Banner shows [staging mode]; frontend env points to staging URL.
    Failure Indicators: Wrong mode badge; URL still localhost.
    Evidence: .sisyphus/evidence/task-2-staging.log

  Scenario: Mode overrides base for shared keys
    Tool: Bash
    Preconditions: .env has BACKEND_PORT=9999; .env.dev has BACKEND_PORT=8000
    Steps:
      1. echo 'BACKEND_PORT=9999' >> .env (backup .env first to .env.bak)
      2. bash -c 'bash start.sh dev & sleep 5; lsof -iTCP:8000 -sTCP:LISTEN | tee /tmp/qa-port.log; kill %1' || true
      3. Restore .env from .env.bak
      4. grep -q LISTEN /tmp/qa-port.log
    Expected Result: Backend bound to 8000 (mode wins over base 9999).
    Failure Indicators: 9999 listening / 8000 not listening.
    Evidence: .sisyphus/evidence/task-2-override.log

  Scenario: Invalid mode rejected, no files written
    Tool: Bash
    Preconditions: rm -f frontend/.env.local
    Steps:
      1. bash start.sh foo > /tmp/qa-foo.log 2>&1 ; echo "exit=$?" >> /tmp/qa-foo.log
      2. grep -q 'Unknown mode: foo' /tmp/qa-foo.log
      3. grep -q 'exit=1' /tmp/qa-foo.log
      4. test ! -e frontend/.env.local
    Expected Result: Error message printed; exit 1; frontend/.env.local NOT created.
    Failure Indicators: Script accepted bad mode; created files anyway.
    Evidence: .sisyphus/evidence/task-2-invalid-mode.log

  Scenario: Prod mode refused
    Tool: Bash
    Preconditions: none special
    Steps:
      1. bash start.sh prod > /tmp/qa-prod.log 2>&1 ; echo "exit=$?" >> /tmp/qa-prod.log
      2. grep -qi 'prod mode is not for local launchers' /tmp/qa-prod.log
      3. grep -q 'exit=1' /tmp/qa-prod.log
      4. ! pgrep -f 'pnpm dev' > /dev/null
    Expected Result: Refusal message; exit 1; no backend started.
    Failure Indicators: prod accepted; backend running.
    Evidence: .sisyphus/evidence/task-2-prod-refused.log

  Scenario: First-run auto-copy of .env.<mode>
    Tool: Bash
    Preconditions: rm -f .env.dev (backup first)
    Steps:
      1. mv .env.dev .env.dev.bak 2>/dev/null || true
      2. bash start.sh dev > /tmp/qa-firstrun.log 2>&1 ; echo "exit=$?" >> /tmp/qa-firstrun.log
      3. grep -q 'Created .env.dev from .env.dev.example' /tmp/qa-firstrun.log
      4. grep -q 'exit=0' /tmp/qa-firstrun.log
      5. test -f .env.dev
      6. diff -q .env.dev .env.dev.example
      7. mv .env.dev.bak .env.dev 2>/dev/null || true
    Expected Result: Auto-create message; exit 0; file matches example.
    Failure Indicators: No auto-create; mismatch with example.
    Evidence: .sisyphus/evidence/task-2-firstrun.log

  Scenario: Help flag exits 0
    Tool: Bash
    Steps:
      1. for arg in --help -h help; do bash start.sh "$arg" > /tmp/qa-help.log 2>&1 ; echo "$arg: exit=$?" >> /tmp/qa-help-summary.log; done
      2. grep -c 'exit=0' /tmp/qa-help-summary.log
      3. grep -q 'Usage: bash start.sh \[mode\]' /tmp/qa-help.log
    Expected Result: All three flags exit 0; usage text printed.
    Failure Indicators: Any flag exits non-zero; missing usage.
    Evidence: .sisyphus/evidence/task-2-help.log
  ```

  **Evidence to Capture**:
  - [ ] All 7 scenarios above (one log per scenario)

  **Commit**: NO (single combined commit at end)

- [x] 3. Add mode support to `start.bat` (Windows parity)

  **What to do**:
  Mirror the start.sh logic in `start.bat` using batch syntax. Implement IN ORDER:

  1. **Argument parsing** (early in script, before any file checks):
     - Read `%1` as `MODE_ARG`.
     - If `%MODE_ARG%` is `--help`, `-h`, or `help`: echo usage block (same content as start.sh, adjusted for `start.bat` invocation) and `exit /b 0`.
     - If empty: `set MODE=dev`.
     - If `dev|staging|prod`: `set MODE=%MODE_ARG%`.
     - Else: `echo ERROR: Unknown mode: %MODE_ARG%. Allowed: dev, staging, prod` and `exit /b 1`.
     - If `MODE==prod`: `echo ERROR: prod mode is not for local launchers. Use docker compose or your real deploy pipeline.` and `exit /b 1`.

  2. **Mode example auto-create**:
     - If `.env.%MODE%` does not exist and `.env.%MODE%.example` does: copy with `copy /Y .env.%MODE%.example .env.%MODE%`, echo notice, `exit /b 0`.
     - If neither exists: error and `exit /b 1`.

  3. **Mode overlay load**:
     - Use whatever loader pattern start.bat already uses for `.env` (likely a `for /f` loop). After loading `.env`, do the same loop on `.env.%MODE%` if it exists. The second pass overrides earlier values via `set`.

  4. **Banner update**: append `[%MODE% mode]` to the banner echo line.

  5. **frontend/.env.local writing**: replace the hardcoded localhost URL with `echo NEXT_PUBLIC_API_URL=%NEXT_PUBLIC_API_URL%> .env.local` (with same fallback to `http://localhost:%BACKEND_PORT%` if unset).

  6. **No other changes**.

  **Must NOT do**:
  - Do not change Windows-specific install/dependency logic.
  - Do not introduce PowerShell — keep it pure batch.
  - Do not export MODE to backend.
  - Do not refactor anything outside the additions listed above.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Batch syntax has many footguns (delayed expansion, `%~` quirks, escaping). Demands care.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2)
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 4, F1-F4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `/start.bat` — read in full first; identify the existing `.env` load block, the banner block, and the `frontend/.env.local` write line. Mirror the start.sh edits at structurally equivalent points.
  - `/start.sh` (the just-edited version from Task 2) — canonical reference for behavior. start.bat must produce the same observable outcomes for each scenario.

  **WHY Each Reference Matters**:
  - User explicitly chose Windows parity. Divergence between scripts is the #1 maintenance risk Metis flagged.
  - start.bat already uses some pattern for `.env`; reuse it for `.env.<mode>` so behavior stays consistent across versions.

  **Acceptance Criteria**:
  - [ ] `start.bat` file modified (verifiable via `git diff --stat`)
  - [ ] Static review confirms each of the 6 changes from "What to do" is present in start.bat
  - [ ] Side-by-side diff vs start.sh: for each behavior anchor (mode parse, auto-create, overlay load, banner, env.local write, prod refusal, help, invalid mode), start.bat has an equivalent block

  **QA Scenarios (MANDATORY)**:

  > Note: No Windows runner available locally. QA is via static review + structural diff.

  ```
  Scenario: Static parity review against start.sh
    Tool: Bash
    Preconditions: Both scripts updated
    Steps:
      1. Extract anchors from start.sh: grep -nE '(MODE=|--help|Unknown mode|prod mode is not|\[.* mode\]|NEXT_PUBLIC_API_URL=)' start.sh > /tmp/sh-anchors.txt
      2. Extract anchors from start.bat: grep -niE '(MODE=|--help|Unknown mode|prod mode is not|\[.* mode\]|NEXT_PUBLIC_API_URL=)' start.bat > /tmp/bat-anchors.txt
      3. Confirm both files contain at least one match per anchor category by counting:
         for kw in 'MODE=' 'help' 'Unknown mode' 'prod mode is not' 'mode\]' 'NEXT_PUBLIC_API_URL='; do
           sh_count=$(grep -ciE "$kw" start.sh)
           bat_count=$(grep -ciE "$kw" start.bat)
           echo "$kw: sh=$sh_count bat=$bat_count"
         done | tee /tmp/parity.log
      4. Manually verify each line in /tmp/parity.log shows non-zero counts on both sides
    Expected Result: Every anchor present in both scripts (counts > 0).
    Failure Indicators: Any anchor missing from start.bat.
    Evidence: .sisyphus/evidence/task-3-parity.log

  Scenario: start.bat batch syntax sanity (best-effort on Linux)
    Tool: Bash
    Steps:
      1. Verify file is not empty: test -s start.bat
      2. Verify CRLF line endings present (Windows convention): file start.bat | grep -q 'CRLF' || echo 'WARN: not CRLF'
      3. Verify no obvious bash-isms leaked: ! grep -E '^\s*(if \[|fi$|then$|do$|done$|esac$)' start.bat
    Expected Result: File non-empty; no bash control structures present.
    Failure Indicators: Bash syntax found in batch file.
    Evidence: .sisyphus/evidence/task-3-batch-sanity.log
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-3-parity.log`
  - [ ] `.sisyphus/evidence/task-3-batch-sanity.log`

  **Commit**: NO (single combined commit at end)

- [x] 4. Update `README.md` with mode usage docs

  **What to do**:
  - Find the existing "Quick Start" section in `README.md`.
  - Add a subsection (or extend Quick Start) explaining the mode flag. Use this exact content (adapt formatting to match surrounding markdown style):
    ```markdown
    ### Modes

    Both `start.sh` and `start.bat` accept a mode argument:

    ```bash
    bash start.sh           # equivalent to: bash start.sh dev
    bash start.sh dev       # local backend + frontend, .env + .env.dev
    bash start.sh staging   # local servers, .env + .env.staging (e.g. point frontend at staging API)
    bash start.sh prod      # REFUSED — use docker compose or your deploy pipeline
    bash start.sh --help    # show usage
    ```

    Each mode loads `.env` first, then overlays `.env.<mode>` on top (mode-specific
    values win). On first run for a given mode, `.env.<mode>` is auto-created from
    the committed `.env.<mode>.example` template — fill in any secrets and re-run.

    Per-mode override files (gitignored, hold your real secrets):
    `.env.dev`, `.env.staging`, `.env.prod`

    Per-mode example templates (committed, contain placeholders only):
    `.env.dev.example`, `.env.staging.example`, `.env.prod.example`
    ```
  - Update the existing Configuration table to add a small note above or below it: `> The variables below can be overridden per-mode by setting them in .env.<mode>.`
  - Update the README's outdated mention of FastAPI backend ONLY if it appears in a sentence you're already touching for mode docs — otherwise leave alone (out of scope per "Must NOT").

  **Must NOT do**:
  - Do not rewrite unrelated README sections.
  - Do not remove the existing Configuration table.
  - Do not add a new top-level section if it duplicates existing structure — extend Quick Start.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Pure documentation prose.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on tasks 2 and 3 being merged so doc reflects reality)
  - **Parallel Group**: Wave 3 (sole task)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `/README.md` (Quick Start section, Configuration table) — match existing prose tone and formatting

  **WHY Each Reference Matters**:
  - README is user-facing. Tone and format consistency reduces cognitive load for new contributors.

  **Acceptance Criteria**:
  - [ ] `grep -q '### Modes' README.md` → exit 0
  - [ ] `grep -q 'bash start.sh staging' README.md` → exit 0
  - [ ] `grep -q 'REFUSED' README.md` → exit 0
  - [ ] `grep -q '\.env\.dev\.example' README.md` → exit 0
  - [ ] No new H1/H2 sections introduced (`! grep -E '^# [^#]' README.md | grep -vqE '^# YUMMY'` — only the original H1 remains)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Mode docs present and discoverable
    Tool: Bash
    Steps:
      1. grep -A 20 '### Modes' README.md | tee /tmp/qa-readme.log
      2. grep -q 'bash start.sh dev' /tmp/qa-readme.log
      3. grep -q 'bash start.sh staging' /tmp/qa-readme.log
      4. grep -q 'REFUSED' /tmp/qa-readme.log
      5. grep -q '\.env\.<mode>' /tmp/qa-readme.log
    Expected Result: All four assertions pass.
    Failure Indicators: Section missing or incomplete.
    Evidence: .sisyphus/evidence/task-4-readme.log

  Scenario: README is still valid markdown (no broken structure)
    Tool: Bash
    Steps:
      1. wc -l README.md (capture line count)
      2. grep -c '^```' README.md (count code fences — must be even)
      3. test $(grep -c '^```' README.md) % 2 -eq 0 || echo 'BROKEN FENCES'
    Expected Result: Even number of fences (no unclosed code blocks).
    Failure Indicators: Odd fence count.
    Evidence: .sisyphus/evidence/task-4-markdown-sanity.log
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-4-readme.log`
  - [ ] `.sisyphus/evidence/task-4-markdown-sanity.log`

  **Commit**: YES (single combined commit at end of all tasks)
  - Message: `feat(scripts): add dev/staging/prod mode support to start.sh and start.bat`
  - Files: `start.sh`, `start.bat`, `.env.dev.example`, `.env.staging.example`, `.env.prod.example`, `.gitignore`, `README.md`
  - Pre-commit: `bash -n start.sh && bash start.sh --help`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read this plan end-to-end. For each "Must Have": verify implementation exists (read file, run script, grep output). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found (e.g. backend/frontend/package.json/docker/CI changes). Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables list against actual git diff.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `bash -n start.sh` (syntax check) and `shellcheck start.sh` (if available, else skip with note). Static-review `start.bat` for matching control flow. Check both scripts for: hardcoded paths, missing quoting, unsafe `rm`, race conditions in cleanup trap, color-code consistency. Verify no `console.log`-equivalent leftover debug echoes.
  Output: `bash -n [PASS/FAIL] | shellcheck [PASS/FAIL/SKIP] | start.bat parity [N matches/N divergences] | VERDICT`

- [x] F3. **Real Manual QA — Mode Matrix** — `unspecified-high`
  Execute the full mode matrix on Linux:
    - `bash start.sh` (no arg) → expects dev behavior
    - `bash start.sh dev`
    - `bash start.sh staging`
    - `bash start.sh prod` → expects refusal
    - `bash start.sh foo` → expects rejection
    - `bash start.sh --help`, `-h`, `help` → expects usage + exit 0
    - First-run scenario: delete `.env.dev`, run `bash start.sh dev`, verify auto-copy
    - Override semantics: set `BACKEND_PORT=9999` in `.env`, `BACKEND_PORT=8000` in `.env.dev`, run dev, verify port 8000 wins
    - frontend/.env.local: verify it contains `NEXT_PUBLIC_API_URL` from `.env.dev` after run
  For start.bat: static-diff verification documented in evidence (no Windows runner).
  Save all terminal captures to `.sisyphus/evidence/final-qa/`.
  Output: `Linux scenarios [N/N pass] | Windows static review [PASS/FAIL] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each of the 4 implementation tasks: read "What to do", read actual diff (`git diff`). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Specifically check NO changes to: `backend-ts/`, `frontend/` (except `frontend/.env.local` which is gitignored and runtime-generated), `package.json`, `pnpm-lock.yaml`, `docker-compose.yml`, `.github/`, any `*.ts`/`*.tsx`/`*.py` file. Check `.env.<mode>.example` for absence of real secrets via regex `(AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36})`.
  Output: `Tasks [N/N compliant] | Out-of-scope changes [CLEAN/N issues] | Secret leak [CLEAN/N hits] | VERDICT`

---

## Commit Strategy

Single conventional commit per task is fine; or one squash commit at the end. Recommended:

- **All tasks**: `feat(scripts): add dev/staging/prod mode support to start.sh and start.bat`
  - Files: `start.sh`, `start.bat`, `.env.dev.example`, `.env.staging.example`, `.env.prod.example`, `.gitignore`, `README.md`
  - Pre-commit: `bash -n start.sh && bash start.sh --help`

---

## Success Criteria

### Verification Commands
```bash
# Mode acceptance
bash start.sh --help                                      # Expected: exit 0, usage text
bash -n start.sh                                          # Expected: exit 0 (syntax OK)
( bash start.sh dev & ) ; sleep 5 ; pkill -P $$ -f "pnpm dev|next dev" ; cat frontend/.env.local
# Expected: NEXT_PUBLIC_API_URL=<value from .env.dev>

# Mode rejection
bash start.sh foo 2>&1 | grep -q "Unknown mode"          # Expected: exit 0 from grep
bash start.sh prod 2>&1 | grep -qi "prod mode is not"    # Expected: exit 0 from grep

# .gitignore
git check-ignore .env.dev .env.staging .env.prod         # Expected: exit 0
git check-ignore .env.dev.example                        # Expected: exit 1

# Secret leak
! grep -rE 'AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36}' .env.*.example
# Expected: exit 0 (no matches)
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent (verified by F4)
- [ ] All QA scenarios pass with evidence files
- [ ] start.sh ↔ start.bat behavior parity confirmed
- [ ] User has given explicit okay after F1-F4 results presented

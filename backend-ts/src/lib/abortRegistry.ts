/**
 * In-memory abort controller registry for SDLC pipeline sessions.
 *
 * Each session can have at most one active AbortController at a time.
 * When the /sdlc/{id}/stop endpoint is called, the registered controller
 * for that session is aborted, which causes any in-flight callAI() promise
 * for that session to reject with an AbortError.
 */

const registry = new Map<string, AbortController>();

/**
 * Register a new AbortController for a session.
 * If one already exists (e.g. stale from a previous run), it is replaced.
 * Returns the new AbortController — pass its .signal to callAI().
 */
export function registerAbort(sessionId: string): AbortController {
  const controller = new AbortController();
  registry.set(sessionId, controller);
  return controller;
}

/**
 * Abort the active controller for a session and remove it from the registry.
 * Returns true if a controller was found and aborted, false otherwise.
 */
export function abortSession(sessionId: string): boolean {
  const controller = registry.get(sessionId);
  if (!controller) return false;
  registry.delete(sessionId);
  controller.abort();
  return true;
}

/**
 * Remove the controller for a session without aborting it (cleanup on success).
 */
export function clearAbort(sessionId: string): void {
  registry.delete(sessionId);
}

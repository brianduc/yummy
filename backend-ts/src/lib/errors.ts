/**
 * HttpError mirrors FastAPI's HTTPException.
 * Middleware converts thrown HttpErrors into `{detail: string}` JSON responses.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.detail = detail;
  }
}

export const badRequest = (detail: string) => new HttpError(400, detail);
export const notFound = (detail: string) => new HttpError(404, detail);
export const conflict = (detail: string) => new HttpError(409, detail);
export const serverError = (detail: string) => new HttpError(500, detail);

export class McpConnectionError extends Error {
  constructor(public serverId: string, message: string) {
    super(`MCP connection error [${serverId}]: ${message}`);
    this.name = 'McpConnectionError';
  }
}

export class McpToolError extends Error {
  constructor(
    public serverId: string,
    public toolName: string,
    message: string,
  ) {
    super(`MCP tool error [${serverId}/${toolName}]: ${message}`);
    this.name = 'McpToolError';
  }
}

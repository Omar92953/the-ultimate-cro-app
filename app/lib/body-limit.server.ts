/**
 * Public routes that read a body (webhooks, Flow, the tracking hook, the MCP endpoint) refuse one that says it is too
 * large before reading it, so a huge upload never fills the server's memory. The length after reading is still checked
 * (a body may be sent without a length).
 */
export function tooLarge(request: Request, max: number) {
  const n = Number(request.headers.get("content-length") ?? "");
  return Number.isFinite(n) && n > max;
}

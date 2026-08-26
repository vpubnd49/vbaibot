export type ResearchErrorKind =
  | "no_results"
  | "rate_limited"
  | "timeout"
  | "invalid_response"
  | "auth_required"
  | "upstream_error";

export class ResearchProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly kind: ResearchErrorKind,
    message: string,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
    public readonly cause?: unknown,
  ) {
    super(`[${provider}] ${kind}: ${message}`);
    this.name = "ResearchProviderError";
  }
}

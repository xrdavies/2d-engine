export interface HttpRequestOptions extends RequestInit {
  timeout?: number;
}

export class HttpClient {
  constructor(readonly baseUrl = "") {}

  async request(
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout =
      options.timeout === undefined
        ? undefined
        : setTimeout(() => controller.abort(), options.timeout);
    const abort = (): void => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) controller.abort(options.signal.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      const requestUrl = this.baseUrl
        ? new URL(url, this.baseUrl).toString()
        : url;
      const response = await fetch(requestUrl, {
        ...options,
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText}`,
        ) as Error & { status: number; body?: unknown };
        error.status = response.status;
        const clone = response.clone();
        try {
          error.body = await clone.json();
          const body = error.body as { message?: string; error?: string };
          if (body?.message || body?.error) {
            error.message = String(body.message || body.error);
          }
        } catch {
          try {
            error.body = await response.text();
          } catch {
            /* ignore */
          }
        }
        throw error;
      }
      return response;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  async json<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    return (await this.request(url, options)).json() as Promise<T>;
  }

  async text(url: string, options: HttpRequestOptions = {}): Promise<string> {
    return (await this.request(url, options)).text();
  }

  async arrayBuffer(
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<ArrayBuffer> {
    return (await this.request(url, options)).arrayBuffer();
  }
}

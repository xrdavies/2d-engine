import { describe, expect, it, vi } from "vitest";
import { HttpClient } from "../../src/net/index.ts";

describe("HttpClient", () => {
  it("checks HTTP status before returning a response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
    );
    await expect(
      new HttpClient("https://example.com").text("/status"),
    ).resolves.toBe("ok");
    vi.unstubAllGlobals();
  });

  it("aborts a request after the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    await expect(
      new HttpClient("https://example.com").text("/slow", { timeout: 1 }),
    ).rejects.toThrow("Abort");
    vi.unstubAllGlobals();
  });
});

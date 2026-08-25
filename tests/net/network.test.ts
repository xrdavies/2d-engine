import { describe, expect, it, vi } from "vitest";
import { HttpClient, WebSocketTransport } from "../../src/net/index.ts";

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

  it("supports a fake WebSocket transport", async () => {
    class FakeSocket extends EventTarget {
      sent: string | ArrayBuffer | Blob | undefined;
      readyState = 0;

      send(data: string | ArrayBuffer | Blob): void {
        this.sent = data;
      }

      close(): void {
        this.readyState = 3;
        this.dispatchEvent(new Event("close"));
      }

      open(): void {
        this.readyState = 1;
        this.dispatchEvent(new Event("open"));
      }
    }
    let socket: FakeSocket | undefined;
    const transport = new WebSocketTransport("ws://test", {
      factory: () => {
        socket = new FakeSocket();
        return socket as unknown as WebSocket;
      },
    });
    const connecting = transport.connect();
    socket?.open();
    await connecting;
    transport.send("hello");
    expect(socket?.sent).toBe("hello");
    transport.dispose();
  });
});

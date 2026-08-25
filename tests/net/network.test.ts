import { describe, expect, it, vi } from "vitest";
import {
  FakeTransport,
  HttpClient,
  WebSocketTransport,
} from "../../src/net/index.ts";

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

  it("honors a signal that was already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")),
    );
    await expect(
      new HttpClient("https://example.com").text("/aborted", {
        signal: controller.signal,
      }),
    ).rejects.toThrow("Abort");
    vi.unstubAllGlobals();
  });

  it("supports a fake WebSocket transport", async () => {
    class FakeSocket extends EventTarget {
      sent: string | ArrayBuffer | Blob | undefined;
      readyState = 0;
      binaryType = "blob";

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

      message(data: unknown): void {
        this.dispatchEvent(new MessageEvent("message", { data }));
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
    const envelopes: string[] = [];
    transport.onEnvelope<{ value: number }>((envelope) =>
      envelopes.push(`${envelope.type}:${envelope.payload.value}`),
    );
    socket?.message(
      JSON.stringify({
        id: "1",
        type: "state",
        payload: { value: 42 },
        timestamp: 1,
      }),
    );
    expect(envelopes).toEqual(["state:42"]);
    transport.dispose();
  });

  it("times out unopened sockets", async () => {
    const transport = new WebSocketTransport("ws://test", {
      connectTimeout: 1,
      factory: () =>
        Object.assign(new EventTarget(), {
          binaryType: "blob",
          close() {},
          send() {},
        }) as unknown as WebSocket,
    });
    await expect(transport.connect()).rejects.toThrow("timed out");
  });

  it("provides a fake with the same message transport API", () => {
    const transport = new FakeTransport();
    const received: string[] = [];
    transport.onMessage((data) => received.push(String(data)));
    transport.send("outgoing");
    transport.receive("incoming");
    expect(transport.sent).toEqual(["outgoing"]);
    expect(received).toEqual(["incoming"]);
  });
});

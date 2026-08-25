export type WebSocketState =
  | "idle"
  | "connecting"
  | "open"
  | "closing"
  | "closed";
export type WebSocketFactory = (
  url: string,
  protocols?: string | string[],
) => WebSocket;

export class WebSocketTransport {
  state: WebSocketState = "idle";
  private socket: WebSocket | undefined;
  private readonly listeners = new Set<(data: string | ArrayBuffer) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly url: string,
    private readonly options: {
      protocols?: string | string[];
      reconnect?: boolean;
      reconnectDelay?: number;
      factory?: WebSocketFactory;
    } = {},
  ) {}

  async connect(): Promise<void> {
    if (this.state === "open") return;
    this.state = "connecting";
    const factory =
      this.options.factory ??
      ((url, protocols) => new WebSocket(url, protocols));
    const socket = factory(this.url, this.options.protocols);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener(
        "open",
        () => {
          this.state = "open";
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => reject(new Error(`WebSocket connection failed: ${this.url}`)),
        { once: true },
      );
      socket.addEventListener("message", (event) => this.emit(event.data));
      socket.addEventListener("close", () => {
        this.state = "closed";
        this.scheduleReconnect();
      });
    });
  }

  send(data: string | ArrayBuffer | Blob): void {
    if (this.state !== "open" || !this.socket)
      throw new Error("WebSocket is not open");
    this.socket.send(data);
  }

  onMessage(listener: (data: string | ArrayBuffer) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(code?: number, reason?: string): void {
    if (!this.socket) return;
    this.state = "closing";
    this.socket.close(code, reason);
  }

  dispose(): void {
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer);
    this.options.reconnect = false;
    this.close();
    this.listeners.clear();
  }

  private emit(data: unknown): void {
    if (typeof data === "string" || data instanceof ArrayBuffer) {
      for (const listener of this.listeners) listener(data);
    }
  }

  private scheduleReconnect(): void {
    if (!this.options.reconnect || this.state === "closing") return;
    if (this.reconnectTimer !== undefined) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect().catch(() => this.scheduleReconnect());
    }, this.options.reconnectDelay ?? 1000);
  }
}

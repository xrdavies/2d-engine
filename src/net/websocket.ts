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

export interface MessageEnvelope<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
}

export interface MessageTransport {
  send(data: string | ArrayBuffer | Blob): void;
  onMessage(listener: (data: string | ArrayBuffer) => void): () => void;
  close(code?: number, reason?: string): void;
}

export interface WebSocketTransportOptions {
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectDelay?: number;
  connectTimeout?: number;
  factory?: WebSocketFactory;
}

export class WebSocketTransport implements MessageTransport {
  state: WebSocketState = "idle";
  private socket: WebSocket | undefined;
  private readonly listeners = new Set<(data: string | ArrayBuffer) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private manuallyClosed = false;

  constructor(
    readonly url: string,
    private readonly options: WebSocketTransportOptions = {},
  ) {}

  async connect(): Promise<void> {
    if (this.state === "open") return;
    this.manuallyClosed = false;
    this.state = "connecting";
    const factory =
      this.options.factory ??
      ((url, protocols) => new WebSocket(url, protocols));
    const socket = factory(this.url, this.options.protocols);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        this.state = "closed";
        reject(new Error(`WebSocket connection timed out: ${this.url}`));
      }, this.options.connectTimeout ?? 10_000);
      socket.addEventListener(
        "open",
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this.state = "open";
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this.state = "closed";
          reject(new Error(`WebSocket connection failed: ${this.url}`));
        },
        { once: true },
      );
      socket.addEventListener("message", (event) => void this.emit(event.data));
      socket.addEventListener("close", () => {
        clearTimeout(timeout);
        this.state = "closed";
        this.scheduleReconnect();
      });
    });
  }

  send(data: string | ArrayBuffer | Blob): void {
    if (this.state !== "open" || !this.socket) {
      throw new Error("WebSocket is not open");
    }
    this.socket.send(data);
  }

  sendEnvelope<T>(envelope: MessageEnvelope<T>): void {
    this.send(JSON.stringify(envelope));
  }

  onMessage(listener: (data: string | ArrayBuffer) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onEnvelope<T>(listener: (envelope: MessageEnvelope<T>) => void): () => void {
    return this.onMessage((data) => {
      if (typeof data !== "string") return;
      const value = JSON.parse(data) as Partial<MessageEnvelope<T>>;
      if (
        typeof value.id !== "string" ||
        typeof value.type !== "string" ||
        typeof value.timestamp !== "number"
      ) {
        throw new Error("Invalid WebSocket message envelope");
      }
      listener(value as MessageEnvelope<T>);
    });
  }

  close(code?: number, reason?: string): void {
    this.manuallyClosed = true;
    if (!this.socket) {
      this.state = "closed";
      return;
    }
    this.state = "closing";
    this.socket.close(code, reason);
  }

  dispose(): void {
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer);
    this.manuallyClosed = true;
    this.close();
    this.listeners.clear();
  }

  private async emit(data: unknown): Promise<void> {
    const normalized = data instanceof Blob ? await data.arrayBuffer() : data;
    if (typeof normalized === "string" || normalized instanceof ArrayBuffer) {
      for (const listener of this.listeners) listener(normalized);
    }
  }

  private scheduleReconnect(): void {
    if (!this.options.reconnect || this.manuallyClosed) return;
    if (this.reconnectTimer !== undefined) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect().catch(() => this.scheduleReconnect());
    }, this.options.reconnectDelay ?? 1000);
  }
}

export class FakeTransport implements MessageTransport {
  private readonly listeners = new Set<(data: string | ArrayBuffer) => void>();
  readonly sent: Array<string | ArrayBuffer | Blob> = [];
  closed = false;

  send(data: string | ArrayBuffer | Blob): void {
    if (this.closed) throw new Error("Transport is closed");
    this.sent.push(data);
  }

  onMessage(listener: (data: string | ArrayBuffer) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  receive(data: string | ArrayBuffer): void {
    for (const listener of this.listeners) listener(data);
  }

  close(): void {
    this.closed = true;
  }
}

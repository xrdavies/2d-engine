import type {
  PreparedText,
  TextLayoutBackend,
  TextLayoutOptions,
  TextLayoutResult,
} from "./layout.ts";

export interface PretextPreparedText {
  readonly prepared: unknown;
  readonly text: string;
  readonly font: string;
  readonly options: TextLayoutOptions;
}

export interface PretextLayoutModule {
  prepareWithSegments(
    text: string,
    font: string,
    options?: {
      whiteSpace?: "normal" | "pre-wrap";
      wordBreak?: "normal" | "keep-all";
      letterSpacing?: number;
    },
  ): unknown;
  layoutWithLines(
    prepared: unknown,
    maxWidth: number,
    lineHeight: number,
  ): {
    width?: number;
    height: number;
    lines: readonly { text: string; width: number }[];
  };
}

/** Adapts @chenglou/pretext without making it a runtime dependency. */
export class PretextTextLayout implements TextLayoutBackend {
  constructor(private readonly module: PretextLayoutModule) {}

  prepare(
    text: string,
    font: string,
    options: TextLayoutOptions = {},
  ): PreparedText {
    const prepared = this.module.prepareWithSegments(text, font, options);
    return {
      text,
      font,
      options,
      graphemes: [],
      widths: [],
      opaque: { prepared, text, font, options },
    } as unknown as PreparedText & { opaque: PretextPreparedText };
  }

  layout(
    prepared: PreparedText,
    maxWidth: number,
    lineHeight: number,
  ): TextLayoutResult {
    const opaque = (prepared as PreparedText & { opaque?: PretextPreparedText })
      .opaque;
    if (!opaque) {
      throw new Error("PretextTextLayout received a foreign prepared value");
    }
    const result = this.module.layoutWithLines(
      opaque.prepared,
      maxWidth,
      lineHeight,
    );
    let cursor = 0;
    const lines = result.lines.map((line) => {
      const start = cursor;
      cursor += Array.from(line.text).length;
      return { text: line.text, width: line.width, start, end: cursor };
    });
    return {
      width: result.width ?? Math.max(0, ...lines.map((line) => line.width)),
      height: result.height,
      lineHeight,
      lines,
    };
  }
}

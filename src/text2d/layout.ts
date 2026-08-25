export interface TextLayoutOptions {
  whiteSpace?: "normal" | "pre-wrap";
  wordBreak?: "normal" | "keep-all";
  letterSpacing?: number;
}

export interface PreparedText {
  readonly text: string;
  readonly font: string;
  readonly options: TextLayoutOptions;
  readonly graphemes: readonly string[];
  readonly widths: readonly number[];
}

export interface TextLine {
  text: string;
  width: number;
  start: number;
  end: number;
}

export interface TextLayoutResult {
  width: number;
  height: number;
  lineHeight: number;
  lines: readonly TextLine[];
}

export interface TextLayoutBackend {
  prepare(
    text: string,
    font: string,
    options?: TextLayoutOptions,
  ): PreparedText;
  layout(
    prepared: PreparedText,
    maxWidth: number,
    lineHeight: number,
  ): TextLayoutResult;
}

export interface TextMeasureContext {
  font: string;
  measureText(text: string): TextMetrics;
}

function segment(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = Intl.Segmenter;
    return Array.from(
      new Segmenter(undefined, { granularity: "grapheme" }).segment(text),
      ({ segment: value }) => value,
    );
  }
  return Array.from(text);
}

export class CanvasTextLayout implements TextLayoutBackend {
  constructor(private readonly context: TextMeasureContext) {}

  prepare(
    text: string,
    font: string,
    options: TextLayoutOptions = {},
  ): PreparedText {
    this.context.font = font;
    const normalized =
      options.whiteSpace === "pre-wrap"
        ? text
        : text.replace(/[ \t\r\f\v]+/g, " ");
    const graphemes = segment(normalized);
    const spacing = options.letterSpacing ?? 0;
    const widths = graphemes.map(
      (value) => this.context.measureText(value).width + spacing,
    );
    return { text, font, options, graphemes, widths };
  }

  layout(
    prepared: PreparedText,
    maxWidth: number,
    lineHeight: number,
  ): TextLayoutResult {
    if (!(maxWidth > 0) || !(lineHeight > 0))
      throw new RangeError("Text layout dimensions must be positive");
    const lines: TextLine[] = [];
    let start = 0;
    let width = 0;
    const pushLine = (end: number): void => {
      const text = prepared.graphemes.slice(start, end).join("");
      lines.push({ text, width, start, end });
      start = end;
      width = 0;
    };
    let lastBreak = -1;
    let index = 0;
    while (index < prepared.graphemes.length) {
      const value = prepared.graphemes[index] as string;
      const valueWidth = prepared.widths[index] as number;
      if (value === "\n") {
        pushLine(index);
        start = index + 1;
        lastBreak = -1;
        index += 1;
        continue;
      }
      if (width > 0 && width + valueWidth > maxWidth) {
        if (prepared.options.wordBreak !== "keep-all" && lastBreak >= start) {
          pushLine(lastBreak);
          start = lastBreak + 1;
          width = 0;
          lastBreak = -1;
          index = start;
          continue;
        }
        pushLine(index);
        start = index;
        width = 0;
        lastBreak = -1;
        continue;
      }
      width += valueWidth;
      if (value === " ") lastBreak = index;
      index += 1;
    }
    if (start < prepared.graphemes.length || lines.length === 0)
      pushLine(prepared.graphemes.length);
    return {
      width: Math.min(
        maxWidth,
        Math.max(0, ...lines.map((line) => line.width)),
      ),
      height: lines.length * lineHeight,
      lineHeight,
      lines,
    };
  }
}

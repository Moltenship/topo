import fs from "node:fs";
import path from "node:path";

export interface RotatingFileSinkOptions {
  readonly filePath: string;
  readonly maxBytes: number;
  readonly maxFiles: number;
  readonly throwOnError?: boolean;
}

export type LogLevel = "Debug" | "Info" | "Warning" | "Error";
export type LogAnnotations = Record<string, unknown>;

const SECRET_KEY_PATTERN = /(key|token|secret|password|authorization)/i;
const TEXT_FIELD_KEYS = new Set([
  "text",
  "transcript",
  "prompt",
  "rawTranscript",
  "clipboard",
  "insertedText",
]);

export class RotatingFileSink {
  private readonly filePath: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private readonly throwOnError: boolean;
  private currentSize = 0;

  constructor(options: RotatingFileSinkOptions) {
    if (options.maxBytes < 1) {
      throw new Error(`maxBytes must be >= 1 (received ${options.maxBytes})`);
    }
    if (options.maxFiles < 1) {
      throw new Error(`maxFiles must be >= 1 (received ${options.maxFiles})`);
    }

    this.filePath = options.filePath;
    this.maxBytes = options.maxBytes;
    this.maxFiles = options.maxFiles;
    this.throwOnError = options.throwOnError ?? false;

    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.pruneOverflowBackups();
    this.currentSize = this.readCurrentSize();
  }

  write(chunk: string | Buffer): void {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    if (buffer.length === 0) {
      return;
    }

    try {
      if (this.currentSize > 0 && this.currentSize + buffer.length > this.maxBytes) {
        this.rotate();
      }

      fs.appendFileSync(this.filePath, buffer);
      this.currentSize += buffer.length;

      if (this.currentSize > this.maxBytes) {
        this.rotate();
      }
    } catch (error) {
      this.currentSize = this.readCurrentSize();
      if (this.throwOnError) {
        throw error;
      }
    }
  }

  private rotate(): void {
    try {
      const maxBackupIndex = this.maxFiles - 1;
      fs.rmSync(this.withSuffix(this.maxFiles), { force: true });

      for (let index = maxBackupIndex - 1; index >= 1; index -= 1) {
        const source = this.withSuffix(index);
        if (fs.existsSync(source)) {
          fs.renameSync(source, this.withSuffix(index + 1));
        }
      }

      if (fs.existsSync(this.filePath)) {
        fs.renameSync(this.filePath, this.withSuffix(1));
      }

      this.currentSize = 0;
    } catch (error) {
      this.currentSize = this.readCurrentSize();
      if (this.throwOnError) {
        throw error;
      }
    }
  }

  private pruneOverflowBackups(): void {
    try {
      const directory = path.dirname(this.filePath);
      const baseName = path.basename(this.filePath);

      for (const entry of fs.readdirSync(directory)) {
        if (!entry.startsWith(`${baseName}.`)) {
          continue;
        }

        const suffix = Number(entry.slice(baseName.length + 1));
        if (Number.isInteger(suffix) && suffix >= this.maxFiles) {
          fs.rmSync(path.join(directory, entry), { force: true });
        }
      }
    } catch (error) {
      if (this.throwOnError) {
        throw error;
      }
    }
  }

  private readCurrentSize(): number {
    try {
      return fs.statSync(this.filePath).size;
    } catch {
      return 0;
    }
  }

  private withSuffix(index: number): string {
    return `${this.filePath}.${index}`;
  }
}

export const sanitizeLogString = (value: string): string => value.replace(/\s+/g, " ").trim();

export const pathBasename = (value: string): string => path.basename(value);

export function redactLogAnnotations(input: LogAnnotations): LogAnnotations {
  const output: LogAnnotations = {};

  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }

    if (TEXT_FIELD_KEYS.has(key)) {
      output[`${key}Length`] = typeof value === "string" ? value.length : null;
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      output[key] = redactLogAnnotations(value as LogAnnotations);
      continue;
    }

    output[key] = value;
  }

  return output;
}

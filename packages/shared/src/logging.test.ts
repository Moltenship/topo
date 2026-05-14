import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { redactLogAnnotations, RotatingFileSink } from "./logging";

describe("RotatingFileSink", () => {
  it("rotates files and prunes backups", () => {
    const dir = mkdtempSync(join(tmpdir(), "topo-logging-"));
    const filePath = join(dir, "topo.trace.ndjson");
    const sink = new RotatingFileSink({
      filePath,
      maxBytes: 10,
      maxFiles: 2,
      throwOnError: true,
    });

    sink.write("123456789\n");
    sink.write("abcdefghi\n");
    sink.write("xyz\n");

    expect(readdirSync(dir).sort()).toEqual(["topo.trace.ndjson", "topo.trace.ndjson.1"]);
    expect(readFileSync(filePath, "utf8")).toBe("xyz\n");
  });
});

describe("redactLogAnnotations", () => {
  it("removes secrets and records text lengths without storing text", () => {
    expect(
      redactLogAnnotations({
        apiKey: "secret",
        prompt: "Clean this transcript",
        text: "user transcript",
        modelId: "whisperkit-small",
      }),
    ).toEqual({
      apiKey: "[REDACTED]",
      promptLength: 21,
      textLength: 15,
      modelId: "whisperkit-small",
    });
  });
});

import { execFileSync } from "node:child_process";

const allowedBasenames = new Set([
  "AGENTS.md",
  "Package.swift",
  "Package.resolved",
]);

const ignoredPathParts = new Set([
  ".git",
  ".local",
  "node_modules",
  "dist",
  "out",
  "coverage",
]);

const kebabCaseFile = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)*$/;

const files = execFileSync("git", ["ls-files", "--", ":(exclude).*", ":(exclude)**/.*"], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);

const violations = files.filter((file) => {
  const parts = file.split("/");
  if (parts.some((part) => ignoredPathParts.has(part))) {
    return false;
  }

  const basename = parts.at(-1);
  return !allowedBasenames.has(basename) && !kebabCaseFile.test(basename);
});

if (violations.length > 0) {
  console.error("Non kebab-case file names found:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

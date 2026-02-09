import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(frontendRoot, "src");
const indexHtmlPath = path.join(frontendRoot, "index.html");

const allowedColorLiteralFiles = new Set([
  path.join(srcRoot, "theme.css")
]);

const colorLiteralPattern = /#(?:[0-9a-fA-F]{3,8})\b|rgba?\(|hsla?\(/g;
const prefersColorSchemeMediaPattern = /@media\s*\(\s*prefers-color-scheme\s*:/g;

const primitiveFunctionNames = [
  "Modal",
  "FormGroup",
  "Input",
  "Select",
  "PopoverSelect",
  "Button",
  "IconButton",
  "Badge"
];

function walkFiles(dir, predicate, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, acc);
      continue;
    }
    if (predicate(fullPath)) acc.push(fullPath);
  }
  return acc;
}

function relative(filePath) {
  return path.relative(frontendRoot, filePath).replaceAll(path.sep, "/");
}

function findMatches(content, pattern) {
  const matches = [];
  for (const match of content.matchAll(pattern)) {
    matches.push({ index: match.index ?? 0, value: match[0] });
  }
  return matches;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function extractFunctionBlock(content, functionName) {
  const signature = `function ${functionName}(`;
  const start = content.indexOf(signature);
  if (start < 0) return null;
  const tail = content.slice(start + signature.length);
  const nextFunctionMatch = /\nfunction\s+[A-Za-z0-9_]+\s*\(/.exec(tail);
  if (!nextFunctionMatch || typeof nextFunctionMatch.index !== "number") {
    return content.slice(start);
  }
  const nextPos = start + signature.length + nextFunctionMatch.index;
  return content.slice(start, nextPos);
}

const errors = [];

const sourceFiles = walkFiles(
  srcRoot,
  (fullPath) => /\.(ts|tsx|css)$/i.test(fullPath)
);

for (const filePath of sourceFiles) {
  if (allowedColorLiteralFiles.has(filePath)) continue;
  const content = fs.readFileSync(filePath, "utf8");
  const matches = findMatches(content, colorLiteralPattern);
  for (const match of matches) {
    const line = lineNumberAt(content, match.index);
    errors.push(
      `[color-literal] ${relative(filePath)}:${line} -> ${match.value}`
    );
  }
}

for (const filePath of [...sourceFiles, indexHtmlPath]) {
  const content = fs.readFileSync(filePath, "utf8");
  const matches = findMatches(content, prefersColorSchemeMediaPattern);
  for (const match of matches) {
    const line = lineNumberAt(content, match.index);
    errors.push(
      `[prefers-color-scheme-media] ${relative(filePath)}:${line} -> ${match.value}`
    );
  }
}

const dashboardPath = path.join(srcRoot, "components", "Dashboard.tsx");
const dashboardContent = fs.readFileSync(dashboardPath, "utf8");
for (const functionName of primitiveFunctionNames) {
  const block = extractFunctionBlock(dashboardContent, functionName);
  if (!block) {
    errors.push(
      `[primitive-missing] src/components/Dashboard.tsx -> function ${functionName} not found`
    );
    continue;
  }
  if (/dark:/.test(block)) {
    errors.push(
      `[primitive-dark-variant] src/components/Dashboard.tsx -> function ${functionName} contains dark: class variant`
    );
  }
}

if (errors.length > 0) {
  console.error("[verify-theme-contract] failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("[verify-theme-contract] OK");

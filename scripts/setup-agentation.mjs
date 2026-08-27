#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ignoredDirs = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "warehouse_data",
]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const withMcp = args.includes("--mcp");
const showHelp = args.includes("--help") || args.includes("-h");
const explicitPath = args.find((arg) => !arg.startsWith("-"));

if (showHelp) {
  console.log(`
Usage:
  node scripts/setup-agentation.mjs [project-dir] [--mcp] [--dry-run]

Examples:
  node scripts/setup-agentation.mjs
  node scripts/setup-agentation.mjs web-stockAI/frontend
  node scripts/setup-agentation.mjs web-stockAI/frontend --mcp

What it does:
  - Finds a React project when no path is provided.
  - Installs agentation as a dev dependency.
  - Adds a development-only Agentation component.
  - Wires it into Next app/layout, Next pages/_app, or React src/App.

Options:
  --mcp      Point the component to NEXT_PUBLIC_AGENTATION_ENDPOINT or localhost:4747.
  --dry-run  Print actions without writing files or installing packages.
`);
  process.exit(0);
}

const repoRoot = process.cwd();
const projectDir = resolveProjectDir(explicitPath ? path.resolve(repoRoot, explicitPath) : repoRoot);
const packageJsonPath = path.join(projectDir, "package.json");
const packageJson = readJson(packageJsonPath);
const packageManager = detectPackageManager(projectDir);

if (!hasReact(packageJson)) {
  fail(`No React dependency found in ${packageJsonPath}`);
}

console.log(`Project: ${projectDir}`);
console.log(`Package manager: ${packageManager.name}`);

installAgentation();

if (hasDependency(packageJson, "next")) {
  setupNextProject();
} else {
  setupPlainReactProject();
}

console.log("Agentation setup complete.");
if (withMcp) {
  console.log("MCP mode enabled. Start the server with:");
  console.log('  npx add-mcp "npx -y agentation-mcp server"');
  console.log("  npx agentation-mcp doctor");
}

function resolveProjectDir(startDir) {
  const directPackageJson = path.join(startDir, "package.json");
  if (fs.existsSync(directPackageJson)) {
    const pkg = readJson(directPackageJson);
    if (hasReact(pkg)) return startDir;
  }

  const candidates = findReactProjects(startDir);
  if (candidates.length === 0) {
    fail(`No React project found under ${startDir}`);
  }

  if (candidates.length === 1) return candidates[0];

  const preferred = candidates.find((candidate) => candidate.endsWith(path.join("web-stockAI", "frontend")));
  if (preferred) return preferred;

  console.log("Multiple React projects found:");
  candidates.forEach((candidate) => console.log(`  - ${path.relative(repoRoot, candidate) || "."}`));
  fail("Pass one project path explicitly, for example: node scripts/setup-agentation.mjs web-stockAI/frontend");
}

function findReactProjects(rootDir) {
  const projects = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.shift();
    let entries = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    if (entries.some((entry) => entry.isFile() && entry.name === "package.json")) {
      const pkgPath = path.join(current, "package.json");
      const pkg = readJson(pkgPath, false);
      if (pkg && hasReact(pkg)) projects.push(current);
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (ignoredDirs.has(entry.name)) continue;
      queue.push(path.join(current, entry.name));
    }
  }

  return projects;
}

function setupNextProject() {
  const extension = usesTypeScript(projectDir) ? "tsx" : "jsx";
  const componentPath = path.join(projectDir, "components", `agentation-dev.${extension}`);
  const appLayout = firstExisting([
    path.join(projectDir, "app", "layout.tsx"),
    path.join(projectDir, "app", "layout.jsx"),
    path.join(projectDir, "src", "app", "layout.tsx"),
    path.join(projectDir, "src", "app", "layout.jsx"),
  ]);
  const pagesApp = firstExisting([
    path.join(projectDir, "pages", "_app.tsx"),
    path.join(projectDir, "pages", "_app.jsx"),
    path.join(projectDir, "src", "pages", "_app.tsx"),
    path.join(projectDir, "src", "pages", "_app.jsx"),
  ]);

  writeFileIfChanged(componentPath, nextAgentationComponent());

  if (appLayout) {
    wireNextAppLayout(appLayout, componentPath);
    return;
  }

  if (pagesApp) {
    wirePagesApp(pagesApp, componentPath);
    return;
  }

  fail("Next was detected, but no app/layout or pages/_app file was found.");
}

function setupPlainReactProject() {
  const appFile = firstExisting([
    path.join(projectDir, "src", "App.tsx"),
    path.join(projectDir, "src", "App.jsx"),
    path.join(projectDir, "App.tsx"),
    path.join(projectDir, "App.jsx"),
  ]);

  if (!appFile) {
    fail("React was detected, but no App.tsx/App.jsx file was found.");
  }

  const extension = appFile.endsWith(".tsx") ? "tsx" : "jsx";
  const componentPath = path.join(projectDir, "src", `AgentationDev.${extension}`);
  writeFileIfChanged(componentPath, plainReactAgentationComponent());
  wirePlainReactApp(appFile, componentPath);
}

function nextAgentationComponent() {
  const endpointLine = withMcp
    ? 'const endpoint = process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || "http://localhost:4747";'
    : "const endpoint = undefined;";

  return `"use client";

import dynamic from "next/dynamic";

const Agentation = dynamic(
  () => import("agentation").then((mod) => mod.Agentation),
  { ssr: false }
);

${endpointLine}

export function AgentationDev() {
  if (process.env.NODE_ENV !== "development") return null;

  return <Agentation endpoint={endpoint} />;
}
`;
}

function plainReactAgentationComponent() {
  const endpointLine = withMcp
    ? 'const endpoint = "http://localhost:4747";'
    : "const endpoint = undefined;";

  return `import { Agentation } from "agentation";

${endpointLine}

export function AgentationDev() {
  if (!import.meta.env.DEV) return null;

  return <Agentation endpoint={endpoint} />;
}
`;
}

function wireNextAppLayout(layoutPath, componentPath) {
  let source = fs.readFileSync(layoutPath, "utf8");
  if (!source.includes("AgentationDev")) {
    const importPath = moduleImportPath(layoutPath, componentPath);
    source = addImport(source, `import { AgentationDev } from "${importPath}"`);
    source = source.replace(/(\s*)<\/body>/, `$1  <AgentationDev />$1</body>`);
    writeFileIfChanged(layoutPath, source);
    return;
  }

  console.log(`Already wired: ${relative(layoutPath)}`);
}

function wirePagesApp(appPath, componentPath) {
  let source = fs.readFileSync(appPath, "utf8");
  if (!source.includes("AgentationDev")) {
    const importPath = moduleImportPath(appPath, componentPath);
    source = addImport(source, `import { AgentationDev } from "${importPath}"`);
    source = source.replace(
      /return\s+<Component\s+\{\.\.\.pageProps\}\s*\/>/,
      "return <><Component {...pageProps} /><AgentationDev /></>"
    );
    writeFileIfChanged(appPath, source);
    return;
  }

  console.log(`Already wired: ${relative(appPath)}`);
}

function wirePlainReactApp(appPath, componentPath) {
  let source = fs.readFileSync(appPath, "utf8");
  if (!source.includes("AgentationDev")) {
    const importPath = moduleImportPath(appPath, componentPath);
    source = addImport(source, `import { AgentationDev } from "${importPath}"`);
    source = source.replace(/(\s*)<\/>/, `$1  <AgentationDev />$1</>`);
    writeFileIfChanged(appPath, source);
    return;
  }

  console.log(`Already wired: ${relative(appPath)}`);
}

function installAgentation() {
  const freshPackageJson = readJson(packageJsonPath);
  if (hasDependency(freshPackageJson, "agentation")) {
    console.log("Dependency already present: agentation");
    return;
  }

  const command = packageManager.installDevCommand("agentation");
  console.log(`Installing: ${command.join(" ")}`);
  if (dryRun) return;

  execFileSync(command[0], command.slice(1), {
    cwd: projectDir,
    stdio: "inherit",
  });
}

function addImport(source, importLine) {
  if (source.includes(importLine)) return source;
  const lastImport = [...source.matchAll(/^import .+$/gm)].at(-1);
  if (!lastImport) return `${importLine}\n${source}`;
  const insertAt = lastImport.index + lastImport[0].length;
  return `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;
}

function moduleImportPath(fromFile, toFile) {
  if (hasAtAlias(projectDir)) {
    const relFromProject = normalizeSlashes(path.relative(projectDir, toFile)).replace(/\.(tsx|jsx|ts|js)$/, "");
    return `@/${relFromProject}`;
  }

  let rel = normalizeSlashes(path.relative(path.dirname(fromFile), toFile)).replace(/\.(tsx|jsx|ts|js)$/, "");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function hasAtAlias(dir) {
  for (const file of ["tsconfig.json", "jsconfig.json"]) {
    const config = readJson(path.join(dir, file), false);
    const paths = config?.compilerOptions?.paths;
    if (paths && Object.prototype.hasOwnProperty.call(paths, "@/*")) return true;
  }
  return false;
}

function detectPackageManager(dir) {
  if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) {
    return { name: "pnpm", installDevCommand: (pkg) => ["pnpm", "add", "-D", pkg] };
  }
  if (fs.existsSync(path.join(dir, "yarn.lock"))) {
    return { name: "yarn", installDevCommand: (pkg) => ["yarn", "add", "-D", pkg] };
  }
  if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) {
    return { name: "bun", installDevCommand: (pkg) => ["bun", "add", "-d", pkg] };
  }
  return { name: "npm", installDevCommand: (pkg) => ["npm", "install", pkg, "-D"] };
}

function writeFileIfChanged(filePath, content) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (current === content) {
    console.log(`Unchanged: ${relative(filePath)}`);
    return;
  }

  console.log(`${current === null ? "Creating" : "Updating"}: ${relative(filePath)}`);
  if (dryRun) return;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function firstExisting(paths) {
  return paths.find((candidate) => fs.existsSync(candidate));
}

function usesTypeScript(dir) {
  return fs.existsSync(path.join(dir, "tsconfig.json"));
}

function hasReact(pkg) {
  return hasDependency(pkg, "react");
}

function hasDependency(pkg, name) {
  return Boolean(pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]);
}

function readJson(filePath, required = true) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (!required) return null;
    fail(`Could not read ${filePath}: ${error.message}`);
  }
}

function normalizeSlashes(value) {
  return value.split(path.sep).join("/");
}

function relative(filePath) {
  return path.relative(repoRoot, filePath) || ".";
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

import { z } from "zod";

export const SettingsSchema = z.object({
  githubToken: z.string().default(""),
  repoFullName: z.string().default(""),
  branch: z.string().default("main"),
  pathTemplate: z.string().default("leetcode/{slug}/{slug}.{ext}"),
  overwriteMode: z.enum(["overwrite", "no-overwrite"]).default("overwrite")
});

export type ShipItSettings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: ShipItSettings = SettingsSchema.parse({});

export function isRepoFullName(v: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v.trim());
}

export function extFromLanguageId(languageId?: string): string {
  const id = (languageId || "").toLowerCase().trim();

  // Comprehensive mapping of Monaco/LeetCode language IDs to file extensions
  const map: Record<string, string> = {
    // Python variants
    python: "py",
    python3: "py",
    "python 3": "py",

    // JavaScript/TypeScript
    javascript: "js",
    typescript: "ts",
    js: "js",
    ts: "ts",

    // Java
    java: "java",

    // C family
    c: "c",
    cpp: "cpp",
    "c++": "cpp",
    csharp: "cs",
    "c#": "cs",

    // Go
    go: "go",
    golang: "go",

    // Mobile/Modern
    kotlin: "kt",
    swift: "swift",

    // Scripting
    ruby: "rb",
    php: "php",
    perl: "pl",

    // Systems
    rust: "rs",

    // JVM
    scala: "scala",

    // Other
    r: "r",
    racket: "rkt",
    elixir: "ex",
    erlang: "erl",
    dart: "dart",
    mysql: "sql",
    mssql: "sql",
    oraclesql: "sql",
    postgresql: "sql",
    sql: "sql",
    bash: "sh",
    shell: "sh",
    plaintext: "txt",
    text: "txt"
  };

  return map[id] || "txt";
}

export function renderPath(template: string, vars: { slug: string; ext: string }): string {
  return template
    .replaceAll("{slug}", vars.slug)
    .replaceAll("{ext}", vars.ext)
    .replaceAll("//", "/");
}

export function buildHeader(meta: { title?: string; url: string; languageId?: string }): string {
  const lines = [
    `// ShipIt`,
    meta.title ? `// Problem: ${meta.title}` : `// Problem:`,
    `// URL: ${meta.url}`,
    meta.languageId ? `// Language: ${meta.languageId}` : `// Language:`,
    `// Pushed: ${new Date().toISOString()}`
  ];
  return lines.join("\n") + "\n\n";
}

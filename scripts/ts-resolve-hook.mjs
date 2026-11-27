// Loader hook for scripts/gen-role-matrix.mjs: resolves the extensionless relative imports of the product API sources to their .ts files (Node strips the types itself).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL && !/\.[cm]?[jt]s$/.test(specifier)) {
    const base = new URL(specifier, context.parentURL);
    for (const ext of [".ts", "/index.ts"]) { const u = new URL(base.href + ext); if (existsSync(fileURLToPath(u))) return next(u.href, context); }
  }
  return next(specifier, context);
}

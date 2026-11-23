#!/usr/bin/env node
// Asserts the DEV ONLY "Test users (dev only)" panel and its synthetic credentials are NOT in a production bundle,
// and (sanity) that they ARE in a development export, so the check cannot pass vacuously.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MARKERS = ["Test users (dev only)", "مستخدمو الاختبار (للتطوير فقط)", "Demo@12345", "nadia.na@demo.kiorex.test", "DevTestUsers", "demoAccounts"];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const hits = (dir) => walk(dir).filter((f) => /\.(js|html|json|css)$/.test(f)).flatMap((f) => { const s = readFileSync(f, "utf8"); return MARKERS.filter((m) => s.includes(m)).map((m) => `${f}: ${m}`); });
const exp = (out, dev) => execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", out, ...(dev ? ["--dev"] : [])], { stdio: "pipe", env: { ...process.env, CI: "1" } });

const prod = mkdtempSync(join(tmpdir(), "kx-prod-")), dev = mkdtempSync(join(tmpdir(), "kx-dev-"));
try {
  exp(prod, false);
  const leaked = hits(prod);
  if (leaked.length) { console.error("FAIL: dev test users found in the PRODUCTION bundle:\n" + leaked.join("\n")); process.exit(1); }
  exp(dev, true);
  if (!hits(dev).length) { console.error("FAIL: sanity check, the DEV export does not contain the panel (check is vacuous)"); process.exit(1); }
  console.log("OK: dev test users absent from the production bundle, present in the dev export");
} finally { rmSync(prod, { recursive: true, force: true }); rmSync(dev, { recursive: true, force: true }); }

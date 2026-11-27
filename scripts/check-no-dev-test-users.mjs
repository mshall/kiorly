#!/usr/bin/env node
// Asserts no "Test users" panel, demo hint or synthetic credential is in ANY bundle (production and development export).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MARKERS = ["Test users (dev only)", "مستخدمو الاختبار (للتطوير فقط)", "Demo@12345", "nadia.na@demo.kiorex.test", "DevTestUsers", "demoAccounts"];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

// A production bundle must not point at a local service: no http(s)://localhost / 127.0.0.1 / [::1] / .test URL may survive (a bare hostname comparison is not a URL).
const LOCAL = /(?:https?:)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])|https?:\/\/[^\s"'`\/]+\.test(?![\w(])/;
const localHits = (dir) => walk(dir).filter((f) => /\.(js|html|json)$/.test(f)).flatMap((f) => { const raw = readFileSync(f, "utf8"); const m = LOCAL.exec(raw); return m ? [`${f}: local address "${raw.slice(Math.max(0, m.index - 50), m.index + 40).replace(/\s+/g, " ")}"`] : []; });
const hits = (dir) => walk(dir).filter((f) => /\.(js|html|json|css)$/.test(f)).flatMap((f) => { const s = readFileSync(f, "utf8"); return MARKERS.filter((m) => s.includes(m)).map((m) => `${f}: ${m}`); });
const exp = (out, dev) => execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", out, ...(dev ? ["--dev"] : [])], { stdio: "pipe", env: { ...process.env, CI: "1", EXPO_NO_DOTENV: "1" /* a developer's .env.local (local API URLs) must not leak into the production export under test */ } });

const prod = mkdtempSync(join(tmpdir(), "kx-prod-")), dev = mkdtempSync(join(tmpdir(), "kx-dev-"));
try {
  exp(prod, false);
  const leaked = [...hits(prod), ...localHits(prod)];
  if (leaked.length) { console.error("FAIL: dev test users found in the PRODUCTION bundle:\n" + leaked.join("\n")); process.exit(1); }
  exp(dev, true);
  const devLeaked = hits(dev);
  if (devLeaked.length) { console.error("FAIL: test users or demo hints found in the DEV export:\n" + devLeaked.join("\n")); process.exit(1); }
  console.log("OK: no test users or demo hints in any bundle; no local address in the production bundle");
} finally { rmSync(prod, { recursive: true, force: true }); rmSync(dev, { recursive: true, force: true }); }

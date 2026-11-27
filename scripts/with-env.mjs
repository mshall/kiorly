#!/usr/bin/env node
// Runs a command with one environment profile of this app (config/env/<profile>.env, generated from the URL registry).
//
//   node scripts/with-env.mjs <local|local-android|test|pilot|prod> -- <command> [args...]
//   node scripts/with-env.mjs test -- npx expo export --platform web --output-dir dist-test
//   node scripts/with-env.mjs test --print                       shows the resolved values (public configuration only)
//
// The profile WINS over variables already in the shell, and a developer's git-ignored .env.local is ignored (EXPO_NO_DOTENV=1), so a build is
// always exactly one named environment and never a mix. No host is typed anywhere else: the files come from _docs/registry/emit-mobile-env.mjs.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [profile, ...rest] = process.argv.slice(2);
const file = path.join(root, "config/env", `${profile}.env`);
if (!profile || !existsSync(file)) { console.error(`usage: with-env.mjs <profile> -- <command>   (profiles: ${["local", "local-android", "test", "pilot", "prod"].join(", ")}; file ${file} not found)`); process.exit(64); }
export const parseEnvFile = (text) => Object.fromEntries(text.split("\n").filter((l) => l.trim() && !l.trimStart().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const vars = parseEnvFile(readFileSync(file, "utf8"));
if (rest[0] === "--print") { for (const [k, v] of Object.entries(vars)) console.log(`${k}=${v}`); process.exit(0); }
const cmd = rest[0] === "--" ? rest.slice(1) : rest;
if (!cmd.length) { console.error("no command given"); process.exit(64); }
const child = spawn(cmd[0], cmd.slice(1), { stdio: "inherit", cwd: root, env: { ...process.env, ...vars, EXPO_NO_DOTENV: "1" } });
child.on("exit", (code, sig) => process.exit(code ?? (sig ? 1 : 0)));

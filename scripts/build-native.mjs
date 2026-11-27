#!/usr/bin/env node
// Local native builds that need NO paid account, no EAS and no Expo account. Pointed at one environment profile (config/env/<profile>.env).
//
//   node scripts/build-native.mjs android test      -> release-mode APK signed with the Android DEBUG key (installable by side-loading)
//   node scripts/build-native.mjs ios-sim test      -> Release .app for the iOS Simulator (arm64), cannot run on a real iPhone
//   env: KX_BUILD_ROOT (default ~/kx-mobile-build), KX_ARTIFACT_DIR (default <workspace>/_private/builds, git-ignored), JAVA_HOME / ANDROID_HOME, KX_ARCH (android, default arm64-v8a)
//
// It never touches this checkout's ios/ and android/ folders or .env.local: the source is copied (APFS clone for node_modules) to KX_BUILD_ROOT, prebuilt
// there with the profile, built, and the artifact copied out. A debug-key APK is for testing only: never upload it to a store.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [target, profile = "test"] = process.argv.slice(2);
if (!["android", "ios-sim"].includes(target)) { console.error("usage: build-native.mjs <android|ios-sim> <profile>"); process.exit(64); }
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const appKey = pkg.name.replace(/^@/, "").replace("/", "-"); // kiorly-app | kiorex-mobile
const buildRoot = process.env.KX_BUILD_ROOT ?? path.join(homedir(), "kx-mobile-build");
const work = path.join(buildRoot, `${appKey}-${profile}`);
const workspaceRoot = (() => { for (let d = root; d !== path.dirname(d); d = path.dirname(d)) if (existsSync(path.join(d, "_private"))) return d; return path.resolve(root, ".."); })(); // the workspace holds the git-ignored _private folder
const artifactDir = process.env.KX_ARTIFACT_DIR ?? path.join(workspaceRoot, "_private/builds", target === "android" ? "android" : "ios-simulator");
const sh = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: "inherit", ...opts }); if (r.status !== 0) { console.error(`FAILED: ${cmd} ${args.join(" ")}`); process.exit(r.status ?? 1); } };
const env = (extra = {}) => ({ ...process.env, CI: "1", ...extra });
const profileVars = () => Object.fromEntries(readFileSync(path.join(root, "config/env", `${profile}.env`), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));

// 1. a clean copy of the source (never the generated native folders, .env files, tests or other builds)
mkdirSync(work, { recursive: true });
sh("rsync", ["-a", "--delete", "--exclude=node_modules", "--exclude=/ios", "--exclude=/android", "--exclude=.git", "--exclude=.env*", "--exclude=dist*", "--exclude=.expo", "--exclude=e2e*", "--exclude=test-results", "--exclude=web-build", `${root}/`, `${work}/`]);
if (!existsSync(path.join(work, "node_modules"))) sh("cp", ["-cR", path.join(root, "node_modules"), path.join(work, "node_modules")]);
const vars = { ...profileVars(), EXPO_NO_DOTENV: "1", EXPO_NO_TELEMETRY: "1" };
const buildEnv = env(vars);

if (target === "android") {
  const javaHome = process.env.JAVA_HOME ?? path.join(homedir(), ".local/jdk17/jdk-17.0.21.1+2/Contents/Home");
  const androidHome = process.env.ANDROID_HOME ?? path.join(homedir(), ".local/android/sdk");
  Object.assign(buildEnv, { JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome, PATH: `${javaHome}/bin:${androidHome}/platform-tools:${process.env.PATH}` });
  sh("npx", ["expo", "prebuild", "--platform", "android", "--no-install", "--clean"], { cwd: work, env: buildEnv });
  mkdirSync(path.join(work, "android"), { recursive: true });
  sh("bash", ["-c", `echo "sdk.dir=${androidHome}" > local.properties`], { cwd: path.join(work, "android") });
  const arch = process.env.KX_ARCH ?? "arm64-v8a";
  sh("./gradlew", [":app:assembleRelease", `-PreactNativeArchitectures=${arch}`, "--no-daemon", "--console=plain"], { cwd: path.join(work, "android"), env: buildEnv });
  const apkDir = path.join(work, "android/app/build/outputs/apk/release");
  const apk = readdirSync(apkDir).find((f) => f.endsWith(".apk"));
  if (!apk) { console.error("no APK produced"); process.exit(1); }
  mkdirSync(artifactDir, { recursive: true });
  const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const out = path.join(artifactDir, `${appKey}-${profile}-${pkg.version}-${sha}.apk`);
  copyFileSync(path.join(apkDir, apk), out);
  console.log(`APK: ${out} (${(statSync(out).size / 1048576).toFixed(1)} MB, signed with the Android debug key, ${arch})`);
} else {
  const gems = path.join(homedir(), ".local/gems");
  Object.assign(buildEnv, { GEM_HOME: gems, PATH: `${gems}/bin:${process.env.PATH}`, LANG: "en_US.UTF-8", RUBYOPT: "-rlogger" });
  sh("npx", ["expo", "prebuild", "--platform", "ios", "--no-install", "--clean"], { cwd: work, env: buildEnv });
  const iosDir = path.join(work, "ios");
  sh("pod", ["install"], { cwd: iosDir, env: buildEnv });
  const ws = readdirSync(iosDir).find((f) => f.endsWith(".xcworkspace"));
  const scheme = ws.replace(".xcworkspace", "");
  const derived = path.join(work, "ios-derived");
  sh("xcodebuild", ["-workspace", path.join(iosDir, ws), "-scheme", scheme, "-configuration", "Release", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", derived, "ARCHS=arm64", "ONLY_ACTIVE_ARCH=NO", "CODE_SIGNING_ALLOWED=NO", "build", "-quiet"], { cwd: iosDir, env: buildEnv });
  const app = path.join(derived, "Build/Products/Release-iphonesimulator", `${scheme}.app`);
  if (!existsSync(app)) { console.error(`no .app at ${app}`); process.exit(1); }
  mkdirSync(artifactDir, { recursive: true });
  const out = path.join(artifactDir, `${appKey}-${profile}.app`);
  sh("rm", ["-rf", out]); sh("cp", ["-R", app, out]);
  console.log(`iOS Simulator app: ${out} (install: xcrun simctl install booted <path>)`);
}

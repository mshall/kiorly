import { Platform, Share } from "react-native";

/**
 * G-16 QR image save. The server renders the QR as an SVG made of horizontal runs (`M4 4.5h7m2 0h1 ...`, error correction M, 4-module quiet zone, black on white).
 * No native media module is added: the SVG is read back into its module grid, drawn as a PNG by a small pure encoder (uncompressed zlib blocks), written to the app cache
 * and handed to the system share sheet, whose "Save Image" (iOS) or "Save" action puts it in the photo library. On the web the PNG downloads as a file. Android's built-in
 * Share cannot carry a file: it falls back to sharing the link (a media-library or expo-sharing module is a human decision, documented as G-16 residual).
 */
export interface QrGrid { size: number; dark: boolean[][] }

/** Parses the runs of the qrcode library SVG: `M x y` starts a row at an absolute point, `h n` paints n modules, `m dx 0` skips. Returns null for anything else. */
export function parseQrSvg(svg: string): QrGrid | null {
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  if (!vb || vb[1] !== vb[2]) return null;
  const size = Number(vb[1]);
  if (!Number.isInteger(size) || size < 21 || size > 177 + 8) return null;
  const strokePath = /<path[^>]*stroke="[^"]*"[^>]*d="([^"]+)"/.exec(svg);
  if (!strokePath) return null;
  const dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const tokens = strokePath[1]!.match(/[MmHh]\s*-?\d*\.?\d+(?:\s+-?\d*\.?\d+)?/g);
  if (!tokens || strokePath[1]!.replace(/[MmHh]\s*-?\d*\.?\d+(?:\s+-?\d*\.?\d+)?/g, "").trim() !== "") return null; // any other command (lines, curves) is not the QR we expect
  let x = 0; let y = 0;
  for (const t of tokens) {
    const cmd = t[0]!; const nums = t.slice(1).trim().split(/\s+/).map(Number);
    if (nums.some((n) => !Number.isFinite(n))) return null;
    if (cmd === "M") { x = nums[0]!; y = nums[1]!; }
    else if (cmd === "m") { x += nums[0]!; y += nums[1] ?? 0; }
    else if (cmd === "h") {
      const row = Math.floor(y); const n = nums[0]!;
      if (row < 0 || row >= size || x < 0 || x + n > size) return null;
      for (let i = 0; i < n; i++) dark[row]![x + i] = true;
      x += n;
    } else return null;
  }
  return { size, dark };
}

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) { crcTable = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function adler32(bytes: Uint8Array): number { let a = 1; let b = 0; for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]!) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; }
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = new Uint8Array([...type].map((c) => c.charCodeAt(0)));
  const body = new Uint8Array(t.length + data.length); body.set(t, 0); body.set(data, t.length);
  return new Uint8Array([...u32(data.length), ...body, ...u32(crc32(body))]);
}

/** 1-bit greyscale PNG of the grid, each module `scale` pixels, plus a white border of `border` modules is NOT added (the quiet zone is already in the grid). */
export function encodeQrPng(grid: QrGrid, scale = 8): Uint8Array {
  const px = grid.size * scale; const rowBytes = Math.ceil(px / 8);
  const raw = new Uint8Array((rowBytes + 1) * px);
  for (let y = 0; y < px; y++) {
    const gy = Math.floor(y / scale); const o = y * (rowBytes + 1); raw[o] = 0;
    for (let x = 0; x < px; x++) { const white = !grid.dark[gy]![Math.floor(x / scale)]; if (white) raw[o + 1 + (x >> 3)]! |= 0x80 >> (x & 7); }
  }
  const blocks: number[] = [0x78, 0x01];
  for (let i = 0; i < raw.length; i += 65535) {
    const part = raw.subarray(i, Math.min(raw.length, i + 65535)); const last = i + 65535 >= raw.length ? 1 : 0;
    blocks.push(last, part.length & 255, part.length >> 8, ~part.length & 255, (~part.length >> 8) & 255, ...part);
  }
  blocks.push(...u32(adler32(raw)));
  const ihdr = new Uint8Array([...u32(px), ...u32(px), 1, 0, 0, 0, 0]); // 1-bit greyscale
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", new Uint8Array(blocks)), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export function qrPngFromSvg(svg: string, scale = 8): Uint8Array | null { const g = parseQrSvg(svg); return g ? encodeQrPng(g, scale) : null; }
export const pngToBase64 = (b: Uint8Array): string => { let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!); return (globalThis as { btoa?: (s: string) => string }).btoa!(s); };

export type SaveQrOutcome = "shared" | "downloaded" | "dismissed" | "unsupported" | "failed";
export interface SaveQrDeps { writeCacheFile?: (name: string, bytes: Uint8Array) => Promise<string>; share?: (o: { url: string }) => Promise<{ action: string }>; os?: string; download?: (name: string, base64: string) => void }

async function writeToCache(name: string, bytes: Uint8Array): Promise<string> {
  const fs = await import("expo-file-system");
  const f = new fs.File(fs.Paths.cache, name);
  if (f.exists) f.delete();
  f.create(); f.write(bytes);
  return f.uri;
}

/** Saves or shares the QR as a PNG. `name` is a file-name stem (letters, digits, dash); anything else is replaced. */
export async function saveQrImage(svg: string, name: string, deps: SaveQrDeps = {}): Promise<SaveQrOutcome> {
  const png = qrPngFromSvg(svg);
  if (!png) return "failed";
  const file = `kiorly-qr-${name.replace(/[^A-Za-z0-9-]+/g, "-").slice(0, 40) || "link"}.png`;
  const os = deps.os ?? Platform.OS;
  try {
    if (os === "web") {
      const b64 = pngToBase64(png);
      if (deps.download) deps.download(file, b64);
      else { const a = (globalThis as { document?: { createElement(t: string): { href: string; download: string; click(): void } } }).document?.createElement("a"); if (!a) return "failed"; a.href = `data:image/png;base64,${b64}`; a.download = file; a.click(); }
      return "downloaded";
    }
    if (os !== "ios") return "unsupported"; // Android's Share cannot carry a file; the screen then offers the link instead (G-16 residual)
    const uri = await (deps.writeCacheFile ?? writeToCache)(file, png);
    const r = await (deps.share ?? ((o) => Share.share(o)))({ url: uri });
    return r.action === Share.dismissedAction ? "dismissed" : "shared";
  } catch { return "failed"; }
}

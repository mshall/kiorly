/**
 * Android status-bar notification icon (expo-notifications plugin `icon` + `color`): must be a 96x96 PNG, white on transparent (Android uses only the alpha channel),
 * generated from the brand mark by _brand/scripts/gen-assets.cjs (never drawn by hand), and wired in app.json with the accent colour.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";

const root = path.resolve(__dirname, "../..");
const ACCENT = "#0369A1";

function decodePng(buf: Buffer) {
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  let p = 8; let w = 0; let h = 0; let ct = -1; let depth = 0; const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.subarray(p + 4, p + 8).toString(); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]!; ct = data[9]!; }
    if (type === "IDAT") idat.push(data);
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const bpp = 4; const stride = w * bpp; const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!; const a = x >= bpp ? out[y * stride + x - bpp]! : 0; const b = y ? out[(y - 1) * stride + x]! : 0; const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp]! : 0;
      const pa = Math.abs(b - c); const pb = Math.abs(a - c); const pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[y * stride + x] = (v + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth)) & 255;
    }
  }
  return { w, h, ct, depth, px: out };
}

describe("Android notification icon", () => {
  const png = decodePng(fs.readFileSync(path.join(root, "assets/notification-icon.png")));
  it("is a 96x96 8-bit RGBA PNG", () => { expect([png.w, png.h, png.ct, png.depth]).toEqual([96, 96, 6, 8]); });
  it("is white on transparent: every visible pixel is white, the corners are clear, and the mark covers a sensible area", () => {
    let visible = 0;
    for (let i = 0; i < png.px.length; i += 4) {
      if (png.px[i + 3]! > 0) { visible++; expect([png.px[i], png.px[i + 1], png.px[i + 2]]).toEqual([255, 255, 255]); }
    }
    expect(png.px[3]).toBe(0); expect(png.px[(96 * 96 - 1) * 4 + 3]).toBe(0);
    expect(visible).toBeGreaterThan(400); expect(visible).toBeLessThan(96 * 96 * 0.5);
  });
  it("is wired into the expo-notifications plugin with the accent colour (kept by app.config.ts)", () => {
    const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
    const entry = app.expo.plugins.find((x: unknown) => Array.isArray(x) && x[0] === "expo-notifications") as [string, Record<string, unknown>];
    expect(entry[1]).toMatchObject({ icon: "./assets/notification-icon.png", color: ACCENT });
    expect(fs.existsSync(path.join(root, String(entry[1].icon)))).toBe(true);
    expect(fs.readFileSync(path.join(root, "app.config.ts"), "utf8")).toContain("...(opts ?? {})");
  });
});

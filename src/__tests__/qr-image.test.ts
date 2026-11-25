import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { parseQrSvg, encodeQrPng, qrPngFromSvg, saveQrImage } from "@/lib/qrImage";

const GOLDEN = readFileSync(require("node:path").join(__dirname, "fixtures", "qr-golden.svg"), "utf8");

describe("QR image save (G-16)", () => {
  it("reads the server QR SVG back into its module grid (37 modules with quiet zone, finder patterns where QR puts them)", () => {
    const g = parseQrSvg(GOLDEN)!;
    expect(g.size).toBe(37);
    // finder pattern top-left starts at (4,4): a 7x7 ring with a solid 3x3 centre
    for (let i = 0; i < 7; i++) { expect(g.dark[4]![4 + i]).toBe(true); expect(g.dark[10]![4 + i]).toBe(true); expect(g.dark[4 + i]![4]).toBe(true); expect(g.dark[4 + i]![10]).toBe(true); }
    expect(g.dark[5]![5]).toBe(false); expect(g.dark[7]![7]).toBe(true);
    expect(g.dark[0]!.some(Boolean)).toBe(false); // quiet zone is white
  });
  it("refuses anything that is not that SVG", () => {
    expect(parseQrSvg("<svg/>")).toBeNull(); expect(parseQrSvg('<svg viewBox="0 0 37 40"></svg>')).toBeNull();
    expect(parseQrSvg('<svg viewBox="0 0 21 21"><path stroke="#000" d="M0 0l5 5"/></svg>')).toBeNull();
    expect(parseQrSvg('<svg viewBox="0 0 21 21"><path stroke="#000" d="M30 0.5h5"/></svg>')).toBeNull();
  });
  it("encodes a valid PNG: signature, IHDR size, and the pixels decode back to the grid", () => {
    const g = parseQrSvg(GOLDEN)!; const png = encodeQrPng(g, 4);
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const dv = new DataView(png.buffer, png.byteOffset); expect(dv.getUint32(16)).toBe(148); expect(dv.getUint32(20)).toBe(148); expect(png[24]).toBe(1); expect(png[25]).toBe(0);
    // IDAT -> inflate -> rows
    let off = 8; let idat: Buffer | null = null;
    while (off < png.length) { const len = dv.getUint32(off); const type = String.fromCharCode(...png.slice(off + 4, off + 8)); if (type === "IDAT") idat = Buffer.from(png.slice(off + 8, off + 8 + len)); off += 12 + len; }
    const raw = inflateSync(idat!); const rowBytes = Math.ceil(148 / 8);
    expect(raw.length).toBe((rowBytes + 1) * 148);
    for (const [gy, gx] of [[4, 4], [5, 5], [7, 7], [0, 0], [20, 20]] as const) {
      const y = gy * 4 + 1; const x = gx * 4 + 1; const bit = (raw[y * (rowBytes + 1) + 1 + (x >> 3)]! >> (7 - (x & 7))) & 1;
      expect(bit === 0).toBe(g.dark[gy]![gx]); // 0 = black = dark module
    }
  });
  it("the CRC of every chunk is correct (a viewer would reject it otherwise)", () => {
    const png = qrPngFromSvg(GOLDEN)!; const dv = new DataView(png.buffer, png.byteOffset);
    const table = (() => { const t: number[] = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t.push(c >>> 0); } return t; })();
    let off = 8; while (off < png.length) { const len = dv.getUint32(off); let c = 0xffffffff; for (const b of png.slice(off + 4, off + 8 + len)) c = table[(c ^ b) & 255]! ^ (c >>> 8); expect(((c ^ 0xffffffff) >>> 0)).toBe(dv.getUint32(off + 8 + len)); off += 12 + len; }
  });
  it("iOS writes the PNG to the cache and opens the share sheet with its file URL; dismissing is reported", async () => {
    const written: { name: string; n: number }[] = [];
    const base = { os: "ios", writeCacheFile: async (name: string, b: Uint8Array) => { written.push({ name, n: b.length }); return `file:///cache/${name}`; } };
    expect(await saveQrImage(GOLDEN, "Front desk/QR", { ...base, share: async (o) => { expect(o.url).toBe("file:///cache/kiorly-qr-Front-desk-QR.png"); return { action: "sharedAction" }; } })).toBe("shared");
    expect(await saveQrImage(GOLDEN, "x", { ...base, share: async () => ({ action: "dismissedAction" }) })).toBe("dismissed");
    expect(written[0]!.n).toBeGreaterThan(1000);
  });
  it("web downloads, Android reports unsupported, bad SVG and errors report failed", async () => {
    let got: { n: string; b: string } | null = null;
    expect(await saveQrImage(GOLDEN, "desk", { os: "web", download: (n, b) => { got = { n, b }; } })).toBe("downloaded");
    expect(got!.n).toBe("kiorly-qr-desk.png"); expect(Buffer.from(got!.b, "base64").slice(1, 4).toString()).toBe("PNG");
    expect(await saveQrImage(GOLDEN, "desk", { os: "android" })).toBe("unsupported");
    expect(await saveQrImage("<svg/>", "desk", { os: "ios" })).toBe("failed");
    expect(await saveQrImage(GOLDEN, "desk", { os: "ios", writeCacheFile: async () => { throw new Error("disk"); } })).toBe("failed");
  });
});

// Copies the Expo launch assets from the shared brand kit (_brand/dist/expo, generated there from the founder artwork with sharp).
// The native splash is deliberately NOT a logo: assets/splash-blank.png is a transparent image, so the launch screen is only the flat brand ground (#3730A3, dark #0F1024) that the JS AnimatedSplash continues seamlessly. Never put a pre-drawn mark there.
// Never redraw the logo here: re-run `cd _brand && npm run build` and then `npm run gen:assets`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../assets");
const src = join(here, "../../_brand/dist/expo");
if (!existsSync(src)) { console.error("brand kit not found at", src, "- keeping the committed assets"); process.exit(0); }
mkdirSync(out, { recursive: true });
for (const [from, to] of [["icon.png", "icon.png"], ["adaptive-foreground.png", "adaptive-icon.png"], ["favicon.png", "favicon.png"]]) copyFileSync(join(src, from), join(out, to));
console.log("assets copied from", src);

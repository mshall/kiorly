/**
 * Server-rendered SVG (share cards, slot cards, QR codes) carries `role="img" aria-label="..."` on the root. react-native-svg's XML parser
 * camel-cases every attribute and, on the web build, hands the DOM element a prop named `ariaLabel`, which React DEV reports as
 * "Invalid ARIA attribute `ariaLabel`" (the dev server only; production builds do not warn). The screens already wrap the image in a
 * `View accessibilityLabel`, so the root's own aria attributes are dropped before parsing; nothing visual changes.
 */
export function stripSvgRootAria(xml: string): string {
  const m = /^\s*<svg\b[^>]*>/i.exec(xml);
  if (!m) return xml;
  const root = m[0].replace(/\s(?:aria-[a-z]+|role)="[^"]*"/gi, "");
  return root + xml.slice(m[0].length);
}

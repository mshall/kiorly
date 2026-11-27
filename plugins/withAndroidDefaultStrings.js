/**
 * `locales` in app.json (the iOS Info.plist translations: CFBundleDisplayName, NSCameraUsageDescription, ...) is ALSO written for Android as
 * res/values-b+ar/strings.xml and res/values-b+en/strings.xml. Android lint (`lintVitalRelease`, part of every release build) then fails with
 * "ExtraTranslation: translated here but not found in default locale" because res/values/strings.xml lacks the keys, so a release APK/AAB could not be built.
 * This plugin writes the English strings into the default locale, which is what lint asks for and changes nothing at runtime (Android never reads these keys).
 */
const fs = require("node:fs");
const path = require("node:path");
const { withStringsXml, AndroidConfig } = require("expo/config-plugins");

module.exports = (config) =>
  withStringsXml(config, (c) => {
    const en = c.locales && c.locales.en;
    if (!en) return c;
    const file = typeof en === "string" ? path.resolve(c.modRequest.projectRoot, en) : null;
    const strings = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : typeof en === "object" ? en : {};
    for (const [name, value] of Object.entries(strings)) {
      c.modResults = AndroidConfig.Strings.setStringItem([{ $: { name }, _: String(value) }], c.modResults);
    }
    return c;
  });

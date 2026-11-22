/** Dev builds only matter here (expo-dev-menu is a no-op in release): default the floating "tools" gear button OFF so it never covers the sign-in header.
 *  iOS reads Info.plist `EXDevMenuShowFloatingActionButton`, Android reads the same manifest meta-data. Still switchable from the dev menu > Tools. */
const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");
module.exports = (config) => {
  config = withInfoPlist(config, (c) => { c.modResults.EXDevMenuShowFloatingActionButton = false; return c; });
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    const md = (app["meta-data"] = app["meta-data"] ?? []);
    const k = "EXDevMenuShowFloatingActionButton";
    const hit = md.find((m) => m.$["android:name"] === k);
    if (hit) hit.$["android:value"] = "false"; else md.push({ $: { "android:name": k, "android:value": "false" } });
    return c;
  });
};

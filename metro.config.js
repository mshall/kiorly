// Everything resolves inside apps/mobile (nested install). The root workspace hoists React 18 for the web app,
// so hierarchical lookup is disabled to keep Metro from ever picking up the root copy.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);
config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;
module.exports = config;

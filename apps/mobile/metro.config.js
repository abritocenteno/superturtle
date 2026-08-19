// Monorepo-aware Metro config: watch the workspace root so Metro can resolve
// @schildpad/core and @schildpad/content from packages/, and use hoisted
// node_modules (see the repo-root .npmrc). Required for Expo + pnpm workspaces.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;

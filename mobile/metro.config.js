const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve files from parent src/ directory (shared code)
const parentSrcDir = path.resolve(__dirname, '..', 'src');
config.watchFolders = [parentSrcDir];

// Ensure node_modules always resolve from mobile/ not parent
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Block parent node_modules from being resolved
const parentNodeModules = path.resolve(__dirname, '..', 'node_modules');
const escapedPath = parentNodeModules.replace(/[/\\]/g, '[/\\\\]');
config.resolver.blockList = [
  new RegExp(`${escapedPath}.*`),
];

module.exports = withNativeWind(config, { input: './global.css' });

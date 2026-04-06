const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Exclude react-native-maps from web platform only
const { isWeb } = require('expo/metro-config');

if (isWeb) {
  config.resolver.blockList = [
    ...config.resolver.blockList || [],
    /react-native-maps/
  ];
}

module.exports = withNativeWind(config, { input: './app/global.css' })
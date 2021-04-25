module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  overrides: [
    {
      test: './src/lib/flatbuffers/event_generated.js',
      sourceType: 'script',
    },
  ],
};

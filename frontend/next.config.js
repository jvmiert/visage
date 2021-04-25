const isProd = process.env.NODE_ENV === "production";

module.exports = {
  env: {
    wsURL: isProd ? "wss://visage.vanmiert.eu/ws" : "wss://dev.vanmiert.eu/ws",
  },
  i18n: {
    locales: ["en", "vi"],
    defaultLocale: "en",
  },
};

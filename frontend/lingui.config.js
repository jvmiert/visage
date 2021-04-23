const nextConfig = require("./next.config");

module.exports = {
  locales: nextConfig.i18n.locales,
  fallbackLocales: {
    default: nextConfig.i18n.defaultLocale,
  },
  catalogs: [
    {
      path: "<rootDir>/locales/{locale}/translation",
      include: ["<rootDir>"],
      exclude: ["**/node_modules/**", "/.next/", "/build/"],
    },
  ],
  format: "po",
};

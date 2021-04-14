const isProd = process.env.NODE_ENV === "production";

module.exports = {
  env: {
    wsURL: isProd ? "wss://visage.vanmiert.eu/ws" : "ws://localhost:8080/ws",
  },
};

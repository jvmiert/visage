const DevConfig = {
  wsURL: "ws://localhost:8081/ws",
};

const StagingConfig = {
  ...DevConfig,
};

const ProdConfig = {
  ...DevConfig,
  wsURL: "wss://visage.vanmiert.eu/ws",
};

const Config =
  !process.env.NODE_ENV || process.env.NODE_ENV === "development"
    ? DevConfig
    : process.env.REACT_APP_STAGING
    ? StagingConfig
    : ProdConfig;

export default Config;

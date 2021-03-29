const DevConfig = {
  wsURL: "ws://localhost:8081/ws",
};

const StagingConfig = {
  ...DevConfig,
};

const ProdConfig = {
  ...DevConfig,
};

const Config =
  !process.env.NODE_ENV || process.env.NODE_ENV === "development"
    ? DevConfig
    : process.env.REACT_APP_STAGING
    ? StagingConfig
    : ProdConfig;

export default Config;

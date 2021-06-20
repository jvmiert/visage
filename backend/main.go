package main

import (
  "flag"
  "net/http"
  "os"
  "os/signal"
  "syscall"
  "time"

  "github.com/gorilla/websocket"
  log "github.com/pion/ion-sfu/pkg/logger"
  "github.com/pion/ion-sfu/pkg/middlewares/datachannel"

  "github.com/pion/ion-sfu/pkg/sfu"
  "github.com/spf13/viper"
)

const (
  pongWait   = 60 * time.Second
  pingPeriod = (pongWait * 9) / 10
)

var (
  conf     = sfu.Config{}
  logger   = log.New()
  upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin:     func(r *http.Request) bool { return true },
  }
)

type SFUServer struct {
  SFU            *sfu.SFU
  nodeKeyMutex   string
  nodeKey        string
  nodeID         string
  nodeURL        string
  nodeRegion     string
  sessionManager *Sessions
  relayManager   *RelayManager
}

func main() {
  viper.SetDefault("NODEID", "dev1")
  viper.SetDefault("NODEURL", "wss://dev.vanmiert.eu/ws")
  viper.SetDefault("NODEREGION", "vn")

  viper.AutomaticEnv()
  viper.SetConfigFile("config.toml")
  viper.SetConfigType("toml")

  err := viper.ReadInConfig()
  if err != nil {
    logger.Error(err, "config file read failed")
  }
  err = viper.GetViper().Unmarshal(&conf)
  if err != nil {
    logger.Error(err, "sfu config file loaded failed")
  }

  log.SetGlobalOptions(log.GlobalConfig{})
  log.SetVLevelByStringGlobal("trace")
  logger.Info("--- Starting SFU Node ---")
  sfu.Logger = logger

  s := &SFUServer{
    nodeKey:      viper.GetString("backend.nodekey"),
    nodeKeyMutex: viper.GetString("backend.nodekeymutex"),
    nodeID:       viper.GetString("NODEID"),
    nodeURL:      viper.GetString("NODEURL"),
    nodeRegion:   viper.GetString("NODEREGION"),
  }

  relayManager, _ := NewRelayManager(s)

  s.relayManager = relayManager

  sManager := &Sessions{
    Sessions: make(map[string]*UserSession),
    SFU:      s,
  }

  s.sessionManager = sManager

  conf.Relay = s.relayManager.signalOffer

  nsfu := sfu.NewSFU(conf)
  dc := nsfu.NewDatachannel(sfu.APIChannelLabel)
  dc.Use(datachannel.SubscriberAPI)

  s.SFU = nsfu

  registerNode(s)

  logger.Info("Created node", "nodeID", s.nodeID, "nodeURL", s.nodeURL, "nodeRegion", s.nodeRegion)

  backendPort := flag.Int("backendport", viper.GetInt("backend.port"), "the port on which the backend runs")
  flag.Parse()

  sigs := make(chan os.Signal, 1)
  signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

  checkin := time.NewTicker(5 * time.Second)

  go StartBackend(s, *backendPort)

  ch, err := s.relayManager.StartListening()

  go s.relayManager.HandleOffer(ch)

  for {
    select {
    case <-sigs:
      logger.Info("Quiting...")
      s.sessionManager.CleanSessions()
      logger.Info("Done cleaning sessions...")
      deregisterNode(s)
      logger.Info("Done deregistering nodes...")
      return
    case <-checkin.C:
    }
  }
}

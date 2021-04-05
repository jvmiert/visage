package main

import (
  "net"
  "net/http"
  "os"

  "github.com/gorilla/mux"
  log "github.com/pion/ion-sfu/pkg/logger"
  "github.com/pion/ion-sfu/pkg/sfu"
)

var (
  conf   = sfu.Config{}
  logger = log.New()
)

func test(w http.ResponseWriter, r *http.Request) {
  w.Write([]byte("hello"))
}

func startBackend() {
  logger.Info("Starting backend...")
  r := mux.NewRouter()
  s := r.PathPrefix("/api").Subrouter()
  s.HandleFunc("/test", test)

  srv := &http.Server{
    Handler: r,
  }

  backendLis, err := net.Listen("tcp", ":8080")
  if err != nil {
    logger.Error(err, "cannot bind to backend endpoint (:8080)")
    os.Exit(1)
  }
  logger.Info("Backend Listening...")

  err = srv.Serve(backendLis)
  if err != nil {
    logger.Error(err, "Backend server stopped")
  }
}

func main() {

  log.SetGlobalOptions(log.GlobalConfig{})
  log.SetVLevelByStringGlobal("trace")
  logger.Info("--- Starting SFU Node ---")
  sfu.Logger = logger

  go startBackend()

  nsfu := sfu.NewSFU(conf)

  _ = nsfu

  select {}

}

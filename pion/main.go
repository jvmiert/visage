package main

import (
  "net"
  "net/http"
  "os"

  "visage/pion/events"

  flatbuffers "github.com/google/flatbuffers/go"
  "github.com/gorilla/mux"
  "github.com/gorilla/websocket"
  log "github.com/pion/ion-sfu/pkg/logger"
  "github.com/pion/ion-sfu/pkg/sfu"
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
  SFU *sfu.SFU
}

func (s *SFUServer) websocketHandler(w http.ResponseWriter, r *http.Request) {

  ws, err := upgrader.Upgrade(w, r, nil)
  if err != nil {
    logger.Error(err, "upgrade error")
    return
  }

  defer ws.Close()

  peer := sfu.NewPeer(s.SFU)

  _ = peer

  /*

     @TODO
       - use s.Lock() when sending, WS is not threadsafe
       - peer.Join(sid, uid string, config ...JoinConfig)
       - setup signalling (join, trickle, SetRemoteDescription, in case of offer -> Answer)
       - when is client publisher? when subscriber?

   **/

  builder := flatbuffers.NewBuilder(0)
  payload := builder.CreateByteString([]byte("test"))
  Uid := builder.CreateString("testuid")
  room := builder.CreateString("testroom")

  events.EventStart(builder)
  events.EventAddType(builder, events.TypeOffer)
  events.EventAddTarget(builder, events.TargetPublisher)
  events.EventAddPayload(builder, payload)
  events.EventAddUid(builder, Uid)
  events.EventAddRoom(builder, room)
  newEvent := events.EventEnd(builder)

  builder.Finish(newEvent)

  finishedBytes := builder.FinishedBytes()

  if err := ws.WriteMessage(websocket.BinaryMessage, finishedBytes); err != nil {
    logger.Error(err, "ws write error")
    return
  }

}

func startBackend(SFU *SFUServer) {
  logger.Info("Starting backend...")

  r := mux.NewRouter()
  s := r.PathPrefix("/api").Subrouter()
  s.HandleFunc("/ws", SFU.websocketHandler)

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

  nsfu := sfu.NewSFU(conf)

  s := &SFUServer{SFU: nsfu}

  go startBackend(s)

  select {}

}

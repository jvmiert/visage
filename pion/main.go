package main

import (
  "fmt"
  "net"
  "net/http"
  "os"

  "visage/pion/events"

  flatbuffers "github.com/google/flatbuffers/go"
  "github.com/gorilla/mux"
  "github.com/gorilla/websocket"
  log "github.com/pion/ion-sfu/pkg/logger"
  "github.com/pion/ion-sfu/pkg/sfu"
  "github.com/pion/webrtc/v3"
  "github.com/spf13/viper"
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

func createMessage(b *flatbuffers.Builder, user []byte, room []byte, payload []byte) []byte {
  builder := flatbuffers.NewBuilder(0)
  payloadString := builder.CreateByteString(payload)
  Uid := builder.CreateByteString(user)
  roomString := builder.CreateByteString(room)

  events.EventStart(builder)
  events.EventAddType(builder, events.TypeOffer)
  events.EventAddTarget(builder, events.TargetPublisher)
  events.EventAddPayload(builder, payloadString)
  events.EventAddUid(builder, Uid)
  events.EventAddRoom(builder, roomString)
  newEvent := events.EventEnd(builder)

  builder.Finish(newEvent)

  return builder.FinishedBytes()

}

func (s *SFUServer) websocketHandler(w http.ResponseWriter, r *http.Request) {

  ws, err := upgrader.Upgrade(w, r, nil)
  if err != nil {
    logger.Error(err, "upgrade error")
    return
  }

  peer := sfu.NewPeer(s.SFU)

  peer.OnIceCandidate = func(candidate *webrtc.ICECandidateInit, target int) {
    fmt.Printf("Got new candidate for peer %s (target: %d) \n", peer.ID(), target)
  }

  peer.OnOffer = func(o *webrtc.SessionDescription) {
    fmt.Printf("Got new offer for peer %s\n", peer.ID())
  }

  defer func() {
    ws.Close()
    peer.Close()
  }()

  err = peer.Join("testroom", "testuser")
  if err != nil {
    logger.Error(err, "join error")
  }

  /*

     @TODO
       - use s.Lock() when sending, WS is not threadsafe
       - peer.Join(sid, uid string, config ...JoinConfig)
       - setup signalling (join, trickle, SetRemoteDescription, in case of offer -> Answer)
       - when is client publisher? when subscriber?

   **/

  builder := flatbuffers.NewBuilder(0)
  finishedBytes := createMessage(builder, []byte("testuser"), []byte("testroom"), []byte("payload"))

  if err := ws.WriteMessage(websocket.BinaryMessage, finishedBytes); err != nil {
    logger.Error(err, "ws write error")
    return
  }

  for {
    _, raw, err := ws.ReadMessage()
    if err != nil {
      logger.Error(err, "ws read message error")
      return
    } 

    logger.Info("Got message: ", "message", raw)
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

  nsfu := sfu.NewSFU(conf)

  s := &SFUServer{SFU: nsfu}

  go startBackend(s)

  select {}

}

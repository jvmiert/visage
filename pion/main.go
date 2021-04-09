package main

import (
  "fmt"
  "net"
  "net/http"
  "os"
  "sync"
  "encoding/json"

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

func createMessage(eventType events.Type, user []byte, room []byte, payload []byte) []byte {
  builder := flatbuffers.NewBuilder(0)
  payloadString := builder.CreateByteString(payload)
  Uid := builder.CreateByteString(user)
  roomString := builder.CreateByteString(room)

  events.EventStart(builder)
  events.EventAddType(builder, eventType)
  events.EventAddTarget(builder, events.TargetPublisher)
  events.EventAddPayload(builder, payloadString)
  events.EventAddUid(builder, Uid)
  events.EventAddRoom(builder, roomString)
  newEvent := events.EventEnd(builder)

  builder.Finish(newEvent)

  return builder.FinishedBytes()

}

func (s *SFUServer) websocketHandler(w http.ResponseWriter, r *http.Request) {
  wsToken, ok := r.URL.Query()["token"]
  if !ok || len(wsToken[0]) < 1 {
    logger.Error(nil, "Url Param 'token' is missing")
    http.Error(w, "no token specified", http.StatusInternalServerError)
  }
  clientID := wsToken[0]

  room, ok := r.URL.Query()["room"]

  if !ok || len(room[0]) < 1 {
    logger.Error(nil, "Url Param 'room' is missing")
    http.Error(w, "no room specified", http.StatusInternalServerError)
  }

  roomID := room[0]

  unsafeConn, err := upgrader.Upgrade(w, r, nil)
  if err != nil {
    logger.Error(err, "upgrade error")
    return
  }

  ws := &threadSafeWriter{unsafeConn, sync.Mutex{}}

  peer := sfu.NewPeer(s.SFU)

  peer.OnIceCandidate = func(candidate *webrtc.ICECandidateInit, target int) {
    fmt.Printf("Got new candidate for peer %s (target: %d) \n", peer.ID(), target)

    out, _ := json.Marshal(candidate)

    finishedBytes := createMessage(
      events.TypeSignal, []byte(clientID),
      []byte(roomID), []byte(string(out)))

    if err := ws.WriteMessage(websocket.BinaryMessage, finishedBytes); err != nil {
      logger.Error(err, "ws write error")
      return
    }
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

  for {
    _, raw, err := ws.ReadMessage()
    if err != nil {
      logger.Error(err, "ws read message error")
      return
    }

    eventMessage := events.GetRootAsEvent(raw, 0)

    switch eventMessage.Type() {
    case events.TypeSignal:
      fmt.Printf("got new type signal: %s \n", eventMessage.Payload())
    }
  }

}

func startBackend(SFU *SFUServer) {
  logger.Info("Starting backend...")

  r := mux.NewRouter()
  r.HandleFunc("/ws", SFU.websocketHandler)
  s := r.PathPrefix("/api").Subrouter()
  s.HandleFunc("/room/join/{room}", JoinRoom)
  s.HandleFunc("/room/create", CreateRoom)

  contextedMux := AddCookieContext(r)

  srv := &http.Server{
    Handler: contextedMux,
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

type threadSafeWriter struct {
  *websocket.Conn
  sync.Mutex
}

func (t *threadSafeWriter) WriteMesage(v []byte) error {
  t.Lock()
  defer t.Unlock()

  return t.Conn.WriteMessage(websocket.BinaryMessage, v)
}

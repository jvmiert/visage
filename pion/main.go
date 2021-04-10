package main

import (
  "fmt"
  "net"
  "net/http"
  "os"
  "sync"

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

func createMessage(eventType events.Type, user []byte, room []byte, payloadString []byte, payloadCandidate *webrtc.ICECandidateInit) []byte {
  builder := flatbuffers.NewBuilder(0)

  Uid := builder.CreateByteString(user)
  roomString := builder.CreateByteString(room)

  var newPayload flatbuffers.UOffsetT
  var newPayloadType byte

  if payloadCandidate != nil {
    candiS := builder.CreateByteString([]byte(payloadCandidate.Candidate))
    sdpS := builder.CreateByteString([]byte(*payloadCandidate.SDPMid))

    var unameS flatbuffers.UOffsetT
    if payloadCandidate.UsernameFragment != nil {
      unameS = builder.CreateByteString([]byte(*payloadCandidate.UsernameFragment))
    } else {
      unameS = builder.CreateByteString([]byte(""))
    }

    events.CandidateTableStart(builder)

    events.CandidateTableAddCandidate(builder, candiS)
    events.CandidateTableAddSdpMid(builder, sdpS)
    events.CandidateTableAddSdpmLineIndex(builder, *payloadCandidate.SDPMLineIndex)
    events.CandidateTableAddUsernameFragment(builder, unameS)

    newPayload = events.CandidateTableEnd(builder)
    newPayloadType = events.PayloadCandidateTable
  }

  if payloadString != nil {
    payloadS := builder.CreateByteString(payloadString)

    events.StringPayloadStart(builder)
    events.StringPayloadAddPayload(builder, payloadS)
    newPayload = events.StringPayloadEnd(builder)
    newPayloadType = events.PayloadStringPayload
  }

  events.EventStart(builder)

  events.EventAddPayloadType(builder, newPayloadType)
  events.EventAddPayload(builder, newPayload)

  events.EventAddType(builder, eventType)
  events.EventAddTarget(builder, events.TargetPublisher)

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
    //fmt.Printf("Got new candidate for peer %s (candidate: %s) \n", peer.ID(), candidate)

    finishedBytes := createMessage(
      events.TypeSignal, []byte(clientID),
      []byte(roomID), nil, candidate)

    if err := ws.SafeWriteMessage(finishedBytes); err != nil {
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

  /*

     @TODO
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
      //fmt.Printf("Signal message received: %s \n")

      unionTable := new(flatbuffers.Table)

      eventMessage.Payload(unionTable)

      candidatePayload := new(events.CandidateTable)
      candidatePayload.Init(unionTable.Bytes, unionTable.Pos)

      var SDPMidString string
      var SdpmLineIndexNum uint16
      var UsernameFragmentString string

      SDPMidString = string(candidatePayload.SdpMid())
      SdpmLineIndexNum = candidatePayload.SdpmLineIndex()
      UsernameFragmentString = string(candidatePayload.UsernameFragment())

      iceCandidate := webrtc.ICECandidateInit{
        Candidate:        string(candidatePayload.Candidate()),
        SDPMid:           &SDPMidString,
        SDPMLineIndex:    &SdpmLineIndexNum,
        UsernameFragment: &UsernameFragmentString,
      }

      peer.Trickle(iceCandidate, 0)

    case events.TypeJoin:
      fmt.Printf("Join message received for room: %s \n", eventMessage.Room())

      unionTable := new(flatbuffers.Table)

      eventMessage.Payload(unionTable)

      eventString := new(events.StringPayload)
      eventString.Init(unionTable.Bytes, unionTable.Pos)

      err = peer.Join(string(eventMessage.Room()), string(eventMessage.Uid()))
      if err != nil {
        logger.Error(err, "join error")
      }
      offer := webrtc.SessionDescription{
        SDP:  string(eventString.Payload()),
        Type: webrtc.SDPTypeOffer,
      }

      answer, _ := peer.Answer(offer)

      finishedBytes := createMessage(
        events.TypeAnswer, []byte(clientID),
        []byte(roomID), []byte(answer.SDP), nil)

      if err := ws.SafeWriteMessage(finishedBytes); err != nil {
        logger.Error(err, "ws write error")
      }
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

func (t *threadSafeWriter) SafeWriteMessage(v []byte) error {
  t.Lock()
  defer t.Unlock()

  return t.Conn.WriteMessage(websocket.BinaryMessage, v)
}

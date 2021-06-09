package main

import (
  "flag"
  "net/http"
  "os"
  "os/signal"
  "strconv"
  "sync"
  "syscall"
  "time"

  "visage/pion/events"

  flatbuffers "github.com/google/flatbuffers/go"
  "github.com/gorilla/websocket"
  log "github.com/pion/ion-sfu/pkg/logger"
  "github.com/pion/ion-sfu/pkg/middlewares/datachannel"

  "github.com/pion/ion-sfu/pkg/sfu"
  "github.com/pion/webrtc/v3"
  "github.com/spf13/viper"
)

const (
  publisher  = 0
  subscriber = 1

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
  SFU *sfu.SFU
}

func (s *SFUServer) websocketHandler(w http.ResponseWriter, r *http.Request) {
  clientToken, ok := r.URL.Query()["token"]
  if !ok || len(clientToken[0]) < 1 {
    logger.Error(nil, "Url Param 'token' is missing")
    http.Error(w, "no token specified", http.StatusInternalServerError)
    return
  }

  clientID := clientToken[0]

  unsafeConn, err := upgrader.Upgrade(w, r, nil)
  if err != nil {
    logger.Error(err, "upgrade error")
    return
  }

  ws := &threadSafeWriter{unsafeConn, sync.Mutex{}}

  ws.SetReadDeadline(time.Now().Add(pongWait))

  peer := sfu.NewPeer(s.SFU)

  defer func() {
    ws.Close()
    peer.Close()
    u, err := getUser(clientID)
    if err == nil {
      _ = u.Leave()
    }
  }()

  for {
    _, raw, err := ws.ReadMessage()
    if err != nil {
      logger.Error(err, "ws read message error")
      return
    }

    // receiving ping message, reset timeout
    if len(raw) == 1 {
      if string(raw) == strconv.Itoa(websocket.PingMessage) {
        ws.SetReadDeadline(time.Now().Add(pongWait))
        continue
      }
    }

    eventMessage := events.GetRootAsEvent(raw, 0)

    switch eventMessage.Type() {
    case events.TypeLatency:
      arrivalTime := time.Now().UnixNano() / 1000000
      unionTable := new(flatbuffers.Table)

      eventMessage.Payload(unionTable)

      latencyPayload := new(events.LatencyPayload)
      latencyPayload.Init(unionTable.Bytes, unionTable.Pos)

      builder := flatbuffers.NewBuilder(0)
      events.LatencyPayloadStart(builder)

      events.LatencyPayloadAddTimestamp(builder, float64(arrivalTime))
      events.LatencyPayloadAddId(builder, latencyPayload.Id())

      newPayload := events.LatencyPayloadEnd(builder)

      events.EventStart(builder)

      events.EventAddPayloadType(builder, events.PayloadLatencyPayload)
      events.EventAddPayload(builder, newPayload)
      events.EventAddType(builder, events.TypeLatency)

      newEvent := events.EventEnd(builder)

      builder.Finish(newEvent)

      finishedBytes := builder.FinishedBytes()

      if err := ws.SafeWriteMessage(finishedBytes); err != nil {
        logger.Error(err, "ws write error")
      }

    case events.TypeSignal:
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
      peer.Trickle(iceCandidate, int(eventMessage.Target()))
    case events.TypeAnswer:
      unionTable := new(flatbuffers.Table)

      eventMessage.Payload(unionTable)

      eventString := new(events.StringPayload)
      eventString.Init(unionTable.Bytes, unionTable.Pos)

      answer := webrtc.SessionDescription{
        SDP:  string(eventString.Payload()),
        Type: webrtc.SDPTypeAnswer,
      }

      peer.SetRemoteDescription(answer)

    case events.TypeJoin:
      unionTable := new(flatbuffers.Table)

      eventMessage.Payload(unionTable)

      eventJoin := new(events.JoinPayload)
      eventJoin.Init(unionTable.Bytes, unionTable.Pos)

      room, clientID, err := getRoomfromToken(string(eventJoin.Token()))

      if err != nil {
        logger.Error(err, "getRoomfromToken error")
        return
      }
      roomID := room.Uid

      peer.OnIceCandidate = func(candidate *webrtc.ICECandidateInit, target int) {
        finishedBytes := serializeICE(candidate, events.Target(target))

        if err := ws.SafeWriteMessage(finishedBytes); err != nil {
          logger.Error(err, "ws write error")
          return
        }
      }

      peer.OnOffer = func(o *webrtc.SessionDescription) {
        finishedBytes := serializeSDP(
          events.TypeOffer, []byte(o.SDP), events.Target(subscriber))

        if err := ws.SafeWriteMessage(finishedBytes); err != nil {
          logger.Error(err, "ws write error")
        }
      }

      // TODO: do we need to do something here in case leave doesn't work?
      peer.OnICEConnectionStateChange = func(s webrtc.ICEConnectionState) {
        if s == webrtc.ICEConnectionStateClosed {
        }
      }

      err = peer.Join(roomID, clientID)
      if err != nil {
        logger.Error(err, "join error")
      }

      offer := webrtc.SessionDescription{
        SDP:  string(eventJoin.Offer()),
        Type: webrtc.SDPTypeOffer,
      }

      answer, err := peer.Answer(offer)

      if err != nil {
        logger.Error(err, "answer error")
        return
      }

      finishedBytes := serializeSDP(
        events.TypeAnswer, []byte(answer.SDP), events.Target(publisher))

      if err := ws.SafeWriteMessage(finishedBytes); err != nil {
        logger.Error(err, "ws write error")
      }
    }
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
  dc := nsfu.NewDatachannel(sfu.APIChannelLabel)
  dc.Use(datachannel.SubscriberAPI)

  s := &SFUServer{SFU: nsfu}

  backendPort := flag.Int("backendport", 8080, "the port on which the backend runs")
  flag.Parse()

  sigs := make(chan os.Signal, 1)
  signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

  checkin := time.NewTicker(5 * time.Second)

  go StartBackend(s, *backendPort)

  for {
    select {
    case <-sigs:
      logger.Info("Quiting...")
      return
    case <-checkin.C:
    }
  }
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

package main

import (
  "math/rand"
  "net/http"
  "strconv"
  "sync"
  "time"
  "visage/pion/events"

  flatbuffers "github.com/google/flatbuffers/go"
  "github.com/gorilla/websocket"
  "github.com/pion/ion-sfu/pkg/sfu"
  "github.com/pion/webrtc/v3"
)

const (
  publisher  = 0
  subscriber = 1
)

type threadSafeWriter struct {
  *websocket.Conn
  sync.Mutex
}

func (t *threadSafeWriter) SafeWriteMessage(v []byte) error {
  t.Lock()
  defer t.Unlock()

  return t.Conn.WriteMessage(websocket.BinaryMessage, v)
}

func websocketHandler(w http.ResponseWriter, r *http.Request) {
  s := r.Context().Value(keySFU).(*SFUServer)

  userToken, ok := r.URL.Query()["token"]
  if !ok || len(userToken[0]) < 1 {
    logger.Error(nil, "Url Param 'token' is missing")
    http.Error(w, "no token specified", http.StatusInternalServerError)
    return
  }

  userID := userToken[0]

  sessionToken, ok := r.URL.Query()["session"]
  if !ok || len(sessionToken[0]) < 1 {
    logger.Error(nil, "Url Param 'session' is missing")
    http.Error(w, "no session specified", http.StatusInternalServerError)
    return
  }

  sessionID := sessionToken[0]

  checkList, ok := r.URL.Query()["check"]
  if !ok || len(checkList[0]) < 1 {
    logger.Error(nil, "Url Param 'check' is missing")
    http.Error(w, "no check specified", http.StatusInternalServerError)
    return
  }

  // check means client is selecting nearest node
  check, err := strconv.ParseBool(checkList[0])

  if err != nil {
    logger.Error(err, "couldn't parse boolean")
    return
  }

  if !check {
    err = s.sessionManager.CreateSession(sessionID, userID)
    if err != nil {
      logger.Error(err, "couldn't save session")
      return
    }
  }

  unsafeConn, err := upgrader.Upgrade(w, r, nil)
  if err != nil {
    logger.Error(err, "upgrade error")
    return
  }

  ws := &threadSafeWriter{unsafeConn, sync.Mutex{}}

  ws.SetReadDeadline(time.Now().Add(pongWait))

  defer func() {
    err = s.sessionManager.RemovePeer(sessionID)
    if err != nil {
      logger.Error(err, "couldn't remove peer")
    }

    session, err := GetSession(sessionID)

    if err != nil {
      logger.Error(err, "Error while getting session when leaving")
      return
    }

    r := &Room{
      Uid: session.RoomID,
    }

    r.RemoveUser(sessionID)

    s.sessionManager.DeleteSession(sessionID)

    ws.Close()
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
      //NOCHECKIN
      delay := rand.Intn(100)
      if delay > 50 {
        time.Sleep(10 * time.Millisecond)
      }

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

      peer, err := s.sessionManager.GetSessionPeer(sessionID)
      if err != nil {
        logger.Error(err, "couldn't get peer")
        return
      }

      peer.Trickle(iceCandidate, int(eventMessage.Target()))

    case events.TypeLeave:
      err = s.sessionManager.RemovePeer(sessionID)
      if err != nil {
        logger.Error(err, "couldn't remove peer")
      }

      session, err := GetSession(sessionID)

      if err != nil {
        logger.Error(err, "Error while getting session when leaving")
        return
      }

      r := &Room{
        Uid: session.RoomID,
      }

      r.RemoveUser(sessionID)

    case events.TypeAnswer:
      unionTable := new(flatbuffers.Table)

      eventMessage.Payload(unionTable)

      eventString := new(events.StringPayload)
      eventString.Init(unionTable.Bytes, unionTable.Pos)

      answer := webrtc.SessionDescription{
        SDP:  string(eventString.Payload()),
        Type: webrtc.SDPTypeAnswer,
      }

      peer, err := s.sessionManager.GetSessionPeer(sessionID)
      if err != nil {
        logger.Error(err, "couldn't get peer")
        return
      }

      peer.SetRemoteDescription(answer)

    case events.TypeOffer:
      unionTable := new(flatbuffers.Table)

      eventMessage.Payload(unionTable)

      eventString := new(events.StringPayload)
      eventString.Init(unionTable.Bytes, unionTable.Pos)

      offer := webrtc.SessionDescription{
        SDP:  string(eventString.Payload()),
        Type: webrtc.SDPTypeOffer,
      }

      peer, err := s.sessionManager.GetSessionPeer(sessionID)
      if err != nil {
        logger.Error(err, "couldn't get peer")
        return
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

      peer := sfu.NewPeer(s.SFU)

      err = s.sessionManager.AddPeer(sessionID, peer)
      if err != nil {
        logger.Error(err, "couldn't set peer")
        return
      }

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
        return
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
      err = s.sessionManager.CheckRelayNeed(sessionID, roomID)
      if err != nil {
        logger.Error(err, "Check relay error")
        return
      }
    }
  }

}

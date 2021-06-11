package main

import (
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

func websocketHandler(w http.ResponseWriter, r *http.Request) {
  s := r.Context().Value(keySFU).(*SFUServer)

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

  defer func() {
    user, err := getUser(clientID)

    if err != nil {
      logger.Error(err, "couldn't find user")
      return
    }

    user.Leave(s)
    ws.Close()
  }()

  for {
    _, raw, err := ws.ReadMessage()
    if err != nil {
      logger.Error(err, "ws read message error")
      user, err := getUser(clientID)

      if err != nil {
        logger.Error(err, "couldn't find user")
        return
      }

      user.Leave(s)
      ws.Close()
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

      user, err := getUser(clientID)

      if err != nil {
        logger.Error(err, "couldn't find user")
        return
      }

      peer, _ := user.GetPeer(s)

      peer.Trickle(iceCandidate, int(eventMessage.Target()))

    case events.TypeLeave:
      user, err := getUser(clientID)

      if err != nil {
        logger.Error(err, "couldn't find user")
        return
      }

      user.Leave(s)

    case events.TypeAnswer:
      unionTable := new(flatbuffers.Table)

      eventMessage.Payload(unionTable)

      eventString := new(events.StringPayload)
      eventString.Init(unionTable.Bytes, unionTable.Pos)

      answer := webrtc.SessionDescription{
        SDP:  string(eventString.Payload()),
        Type: webrtc.SDPTypeAnswer,
      }

      user, err := getUser(clientID)

      if err != nil {
        logger.Error(err, "couldn't find user")
        return
      }

      peer, _ := user.GetPeer(s)

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

      user, err := getUser(clientID)

      if err != nil {
        logger.Error(err, "couldn't find user")
        return
      }

      peer, _ := user.GetPeer(s)

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

      user, err := getUser(clientID)

      if err != nil {
        logger.Error(err, "couldn't find user")
        return
      }

      user.LinkPeer(s, peer)

      user.Region = s.nodeRegion
      user.NodeID = s.nodeID
      user.SaveUser()

      if err != nil {
        logger.Error(err, "couldn't save user")
        return
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
    }
  }

}

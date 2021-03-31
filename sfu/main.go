package main

import (
  "context"
  "encoding/json"
  "fmt"
  "log"
  "net/http"
  "sync"
  "time"

  "github.com/go-redis/redis/v8"
  "github.com/gorilla/websocket"
  "github.com/pion/interceptor"
  "github.com/pion/rtcp"
  "github.com/pion/webrtc/v3"
)

var (
  ctx = context.Background()

  listLock    sync.RWMutex
  peerMap     map[string]map[string]peerConnectionState
  trackLocals map[string]map[string]*webrtc.TrackLocalStaticRTP

  upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
  }
)

type peerConnectionState struct {
  peerConnection *webrtc.PeerConnection
  websocket      *threadSafeWriter
}

type wsMessage struct {
  Event   string
  Payload string
}

type peerInfo struct {
  IsPresent bool
  IsHost    bool
}

func main() {
  fmt.Println("Starting SFU...")
  peerMap = make(map[string]map[string]peerConnectionState)
  trackLocals = make(map[string]map[string]*webrtc.TrackLocalStaticRTP)

  http.HandleFunc("/ws", websocketHandler)

  // request a keyframe every 3 seconds
  go func() {
    for range time.NewTicker(time.Second * 3).C {
      dispatchKeyFrame()
    }
  }()

  log.Fatal(http.ListenAndServe(":8081", nil))

}

func updateTracks(roomID string) {
  listLock.Lock()
  defer func() {
    listLock.Unlock()
    dispatchKeyFrame()
    log.Println("Done updating tracks in room: ", roomID)
  }()

  log.Println("Updating tracks in room: ", roomID)
  for i := range peerMap[roomID] {
      tracksNoSend := map[string]bool{}

      for _, sender := range peerMap[roomID][i].peerConnection.GetSenders() {
        if sender.Track() == nil {
          continue
        }
        tracksNoSend[sender.Track().ID()] = true
        //log.Println("Found sender track: ", sender.Track().ID())
      }

      for _, receiver := range peerMap[roomID][i].peerConnection.GetReceivers() {
        if receiver.Track() == nil {
          continue
        }
        tracksNoSend[receiver.Track().ID()] = true
        //log.Println("Found receiver track: ", receiver.Track().ID())
      }

      for trackID := range trackLocals[roomID] {
        if _, present := tracksNoSend[trackID]; !present {
          log.Printf("Need to add track %s to peer %s", trackID, i)
          if _, err := peerMap[roomID][i].peerConnection.AddTrack(trackLocals[roomID][trackID]); err != nil {
            log.Println("AddTrack error: ", err)
          }
        }
      }

      if err := peerMap[roomID][i].websocket.WriteJSON(&wsMessage{
        Event:   "reoffer",
        Payload: "",
      }); err != nil {
        log.Printf("senderror (%s) \n", err)
        return
      }

  }
}

func addTrack(t *webrtc.TrackRemote, roomID string) *webrtc.TrackLocalStaticRTP {
  listLock.Lock()
  defer func() {
    listLock.Unlock()
    updateTracks(roomID)
  }()

  // Create a new TrackLocal with the same codec as our incoming
  trackLocal, err := webrtc.NewTrackLocalStaticRTP(t.Codec().RTPCodecCapability, t.ID(), t.StreamID())
  if err != nil {
    panic(err)
  }

  if _, present := trackLocals[roomID]; !present {
    trackLocals[roomID] = make(map[string]*webrtc.TrackLocalStaticRTP)
  }

  trackLocals[roomID][t.ID()] = trackLocal
  return trackLocal
}

func removeTrack(t *webrtc.TrackLocalStaticRTP, roomID string) {
  listLock.Lock()
  defer func() {
    listLock.Unlock()
    updateTracks(roomID)
  }()

  delete(trackLocals[roomID], t.ID())
}

// dispatchKeyFrame sends a keyframe to all PeerConnections, used everytime a new user joins the call
func dispatchKeyFrame() {
  listLock.Lock()
  defer listLock.Unlock()

  for i := range peerMap {
    for j := range peerMap[i] {
      for _, receiver := range peerMap[i][j].peerConnection.GetReceivers() {
        if receiver.Track() == nil {
          continue
        }

        _ = peerMap[i][j].peerConnection.WriteRTCP([]rtcp.Packet{
          &rtcp.PictureLossIndication{
            MediaSSRC: uint32(receiver.Track().SSRC()),
          },
        })
      }
    }
  }
}

func websocketHandler(w http.ResponseWriter, r *http.Request) {
  cookie, err := r.Cookie("visageUser")
  if err != nil {
    http.Error(w, "no user id", http.StatusInternalServerError)
  }

  clientID := cookie.Value

  room, ok := r.URL.Query()["room"]

  if !ok || len(room[0]) < 1 {
    log.Println("Url Param 'room' is missing")
    http.Error(w, "no room specified", http.StatusInternalServerError)
  }

  roomID := room[0]

  log.Printf("WS connection for room: %s (user: %s)", roomID, clientID)

  rdb := redis.NewClient(&redis.Options{
    Addr:     "localhost:6379",
    Password: "",
    DB:       0,
  })

  s := webrtc.SettingEngine{}
  //s.SetNAT1To1IPs([]string{"192.168.1.137"}, webrtc.ICECandidateTypeHost)
  s.SetLite(true)
  s.SetEphemeralUDPPortRange(5000, 5500)

  mediaEngine := &webrtc.MediaEngine{}
  if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
    panic(err)
  }

  i := &interceptor.Registry{}

  if err := webrtc.RegisterDefaultInterceptors(mediaEngine, i); err != nil {
    panic(err)
  }

  api := webrtc.NewAPI(
    webrtc.WithSettingEngine(s),
    webrtc.WithInterceptorRegistry(i),
    webrtc.WithMediaEngine(mediaEngine))

  unsafeConn, err := upgrader.Upgrade(w, r, nil)
  if err != nil {
    log.Print("upgrade:", err)
    return
  }

  c := &threadSafeWriter{unsafeConn, sync.Mutex{}}

  if _, present := peerMap[roomID]; !present {
    listLock.Lock()
    peerMap[roomID] = make(map[string]peerConnectionState)
    listLock.Unlock()
  }

  log.Printf("Creating new peer in room: %s (%s) \n", roomID, clientID)
  peer, _ := api.NewPeerConnection(webrtc.Configuration{})

  peer.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
    log.Printf("Connection State has changed %s (%s, %s) \n", connectionState.String(), roomID, clientID)
  })

  peer.OnNegotiationNeeded(func() {
    log.Printf("OnNegotiationNeeded (%s) \n", clientID)
  })

  peer.OnConnectionStateChange(func(p webrtc.PeerConnectionState) {
    log.Printf("OnConnectionStateChange -> %s (%s) \n", p.String(), clientID)
    switch p {
    case webrtc.PeerConnectionStateFailed:
      if err := peer.Close(); err != nil {
        log.Print(err)
      }
    case webrtc.PeerConnectionStateClosed:
      updateTracks(roomID)
    }
  })

  peer.OnICECandidate(func(i *webrtc.ICECandidate) {
    if i == nil {
      return
    }

    candidateString, _ := json.Marshal(i.ToJSON())

    if err = c.WriteJSON(&wsMessage{
      Event:   "candidate",
      Payload: string(candidateString),
    }); err != nil {
      log.Printf("senderror (%s) \n", err)
      return
    }
  })
  peer.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
    trackLocal := addTrack(track, roomID)
    defer removeTrack(trackLocal, roomID)
    log.Printf("Track has started, of type %d: %s \n", track.PayloadType(), track.Codec().MimeType)

    buf := make([]byte, 1500)
    for {
      i, _, err := track.Read(buf)
      if err != nil {
        return
      }

      if _, err = trackLocal.Write(buf[:i]); err != nil {
        return
      }
    }
  })

  listLock.Lock()
  peerMap[roomID][clientID] = peerConnectionState{peer, c}
  listLock.Unlock()

  defer func() {
    log.Printf("Closing WS connection for room: %s (user: %s)", roomID, clientID)
    peerMap[roomID][clientID].websocket.Close()
    peerMap[roomID][clientID].peerConnection.Close()
    delete(peerMap[roomID], clientID)
  }()

  message := &wsMessage{}

  for {
    _, raw, err := peerMap[roomID][clientID].websocket.ReadMessage()
    if err != nil {
      log.Println(err)
      return
    } else if err := json.Unmarshal(raw, &message); err != nil {
      log.Println(err)
      return
    }

    switch message.Event {
    case "offer":
      log.Println("Got new offer")

      occupants, _ := rdb.HGet(ctx, roomID, "occupants").Result()
      occupantsInfo := map[string]*peerInfo{}
      json.Unmarshal([]byte(occupants), &occupantsInfo)
      occupantsInfo[clientID].IsPresent = true
      roomJSON, err := json.Marshal(occupantsInfo)
      if err != nil {
        panic(err)
      }
      rdb.HSet(ctx, roomID, "occupants", roomJSON)

      offer := webrtc.SessionDescription{}
      if err := json.Unmarshal([]byte(message.Payload), &offer); err != nil {
        log.Println(err)
      }
      if err := peerMap[roomID][clientID].peerConnection.SetRemoteDescription(offer); err != nil {
        log.Println(err)
      }

      answer, err := peerMap[roomID][clientID].peerConnection.CreateAnswer(nil)
      if err != nil {
        panic(err)
      } else if err = peerMap[roomID][clientID].peerConnection.SetLocalDescription(answer); err != nil {
        panic(err)
      }

      answerString, err := json.Marshal(answer)
      if err != nil {
        panic(err)
      }

      if err = peerMap[roomID][clientID].websocket.WriteJSON(&wsMessage{
        Event:   "answer",
        Payload: string(answerString),
      }); err != nil {
        panic(err)
      }
    }
  }

}

// Helper to make Gorilla Websockets threadsafe
type threadSafeWriter struct {
  *websocket.Conn
  sync.Mutex
}

func (t *threadSafeWriter) WriteJSON(v interface{}) error {
  t.Lock()
  defer t.Unlock()

  return t.Conn.WriteJSON(v)
}

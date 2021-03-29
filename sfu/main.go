package main

import (
  "context"
  "encoding/json"
  "fmt"
  "log"
  "sync"
  "time"
  "net/http"

  "github.com/go-redis/redis/v8"
  "github.com/pion/interceptor"
  "github.com/pion/rtcp"
  "github.com/pion/webrtc/v3"
  "github.com/gorilla/websocket"
)

var (
  ctx = context.Background()

  listLock    sync.RWMutex
  peerMap     map[string]map[string]*webrtc.PeerConnection
  trackLocals map[string]*webrtc.TrackLocalStaticRTP
  rtpSenders  map[string]*webrtc.RTPSender

  upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
  }
)

type SFURequest struct {
  Type     string
  ClientID string
  RoomID   string
  Payload  string
}

type wsMessage struct {
  Event    string
  Payload string
}

type peerInfo struct {
  IsPresent bool
  IsHost    bool
}

func main() {
  peerMap = make(map[string]map[string]*webrtc.PeerConnection)
  trackLocals = map[string]*webrtc.TrackLocalStaticRTP{}
  rtpSenders = map[string]*webrtc.RTPSender{}

  rdb := redis.NewClient(&redis.Options{
    Addr:     "localhost:6379",
    Password: "",
    DB:       0,
  })

  http.HandleFunc("/ws", websocketHandler)

  log.Fatal(http.ListenAndServe(":8081", nil))

  pubsub := rdb.Subscribe(ctx, "sfu_info")

  ch := pubsub.Channel()

  for msg := range ch {
    var request SFURequest
    err := json.Unmarshal([]byte(msg.Payload), &request)

    if err != nil {
      fmt.Println("Couldn't decode message...")
    }

    switch request.Type {
    case "candidate":
      if _, present := peerMap[request.RoomID]; !present {
        //fmt.Println("Room not in peerMap (candidate)")
        break
      }

      if _, present := peerMap[request.RoomID][request.ClientID]; !present {
        //fmt.Println("Peer not in peerMap (candidate)")
        break
      }

      candidate := webrtc.ICECandidateInit{}
      if err := json.Unmarshal([]byte(request.Payload), &candidate); err != nil {
        fmt.Println(err)
      }
      if err := peerMap[request.RoomID][request.ClientID].AddICECandidate(candidate); err != nil {
        log.Println(err)
      }
      //fmt.Println("set candidate for: ", request.ClientID)
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

  // if err := webrtc.RegisterDefaultInterceptors(mediaEngine, i); err != nil {
  //   panic(err)
  // }

  if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
    RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "video/VP8", ClockRate: 90000, Channels: 0, SDPFmtpLine: "", RTCPFeedback: nil},
    PayloadType:        96,
  }, webrtc.RTPCodecTypeVideo); err != nil {
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

  defer func() {
    log.Printf("Closing WS connection for room: %s (user: %s)", roomID, clientID)
    c.Close()
    peerMap[roomID][clientID].Close()
    delete(peerMap[roomID], clientID)
  }()

  message := &wsMessage{}

  for {
    _, raw, err := c.ReadMessage()
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

      listLock.Lock()
      if _, present := peerMap[roomID]; !present {
        peerMap[roomID] = make(map[string]*webrtc.PeerConnection)
      }
      if peerMap[roomID][clientID] == nil {
        fmt.Printf("Creating new peer in room: %s (%s) \n", roomID, clientID)
        peerConnection, _ := api.NewPeerConnection(webrtc.Configuration{})
        peerMap[roomID][clientID] = peerConnection

        trackLocals[clientID], err = webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: "video/vp8"}, "video", clientID)
        if err != nil {
          panic(err)
        }

        rtpSenders[clientID], err = peerConnection.AddTrack(trackLocals[clientID])
        if err != nil {
          panic(err)
        }

        go func() {
          rtcpBuf := make([]byte, 1500)
          for {
            if _, _, rtcpErr := rtpSenders[clientID].Read(rtcpBuf); rtcpErr != nil {
              return
            }
          }
        }()

        peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
          log.Printf("Connection State has changed %s (%s, %s) \n", connectionState.String(), roomID, clientID)
        })

        peerConnection.OnNegotiationNeeded(func() {
          log.Printf("OnNegotiationNeeded (%s) \n", clientID)
        })

        peerConnection.OnICECandidate(func(i *webrtc.ICECandidate) {
          if i == nil {
            return
          }

          candidateString, _ := json.Marshal(i.ToJSON())

          if err = c.WriteJSON(&wsMessage{
            Event: "candidate",
            Payload:  string(candidateString),
          }); err != nil {
            return
          }

          // @TODO: send with WS to browser
        })
        peerConnection.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
          // Send a PLI on an interval so that the publisher is pushing a keyframe every rtcpPLIInterval
          // This is a temporary fix until we implement incoming RTCP events, then we would push a PLI only when a viewer requests it
          go func() {
            ticker := time.NewTicker(time.Second * 3)
            for range ticker.C {
              errSend := peerConnection.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: uint32(track.SSRC())}})
              if errSend != nil {
                fmt.Println(errSend)
                return
              }
            }
          }()

          log.Printf("Track has started, of type %d: %s \n", track.PayloadType(), track.Codec().MimeType)
          for {
            // Read RTP packets being sent to Pion
            rtp, _, readErr := track.ReadRTP()
            if readErr != nil {
              log.Println("ReadRTP error: ", readErr)
              return
              //panic(readErr)
            }

            if writeErr := trackLocals[clientID].WriteRTP(rtp); writeErr != nil {
              log.Println("WriteRTP error: ", writeErr)
              return
              //panic(writeErr)
            }
          }
        })
        occupants, _ := rdb.HGet(ctx, roomID, "occupants").Result()
        occupantsInfo := map[string]*peerInfo{}
        json.Unmarshal([]byte(occupants), &occupantsInfo)
        occupantsInfo[clientID].IsPresent = true
        roomJSON, err := json.Marshal(occupantsInfo)
        if err != nil {
          panic(err)
        }
        rdb.HSet(ctx, roomID, "occupants", roomJSON)
      }
      listLock.Unlock()

      offer := webrtc.SessionDescription{}
      if err := json.Unmarshal([]byte(message.Payload), &offer); err != nil {
        log.Println(err)
      }
      if err := peerMap[roomID][clientID].SetRemoteDescription(offer); err != nil {
        log.Println(err)
      }

      answer, err := peerMap[roomID][clientID].CreateAnswer(nil)
      if err != nil {
        panic(err)
      } else if err = peerMap[roomID][clientID].SetLocalDescription(answer); err != nil {
        panic(err)
      }

      answerString, err := json.Marshal(answer)
      if err != nil {
        panic(err)
      }

      if err = c.WriteJSON(&wsMessage{
        Event: "answer",
        Payload:  string(answerString),
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

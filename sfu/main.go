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

type backendReply struct {
  Type    string
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

  http.HandleFunc("/ws", websocketHandler)

  log.Fatal(http.ListenAndServe(":8081", nil))

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

    case "offer":
      listLock.Lock()
      if _, present := peerMap[request.RoomID]; !present {
        peerMap[request.RoomID] = make(map[string]*webrtc.PeerConnection)
      }
      if peerMap[request.RoomID][request.ClientID] == nil {
        fmt.Printf("Creating new peer in room: %s (%s) \n", request.RoomID, request.ClientID)
        peerConnection, _ := api.NewPeerConnection(webrtc.Configuration{})
        peerMap[request.RoomID][request.ClientID] = peerConnection

        trackLocals[request.ClientID], err = webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: "video/vp8"}, "video", request.ClientID)
        if err != nil {
          panic(err)
        }

        rtpSenders[request.ClientID], err = peerConnection.AddTrack(trackLocals[request.ClientID])
        if err != nil {
          panic(err)
        }

        go func() {
          rtcpBuf := make([]byte, 1500)
          for {
            if _, _, rtcpErr := rtpSenders[request.ClientID].Read(rtcpBuf); rtcpErr != nil {
              return
            }
          }
        }()

        peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
          fmt.Printf("Connection State has changed %s (%s, %s) \n", connectionState.String(), request.RoomID, request.ClientID)
        })

        peerConnection.OnNegotiationNeeded(func() {
          fmt.Printf("OnNegotiationNeeded (%s) \n", request.ClientID)
        })

        peerConnection.OnICECandidate(func(i *webrtc.ICECandidate) {
          if i == nil {
            rReply := backendReply{
              Type:    "done",
              Payload: "",
            }

            js, err := json.Marshal(rReply)
            if err != nil {
              panic(err)
            }
            err = rdb.Publish(ctx, request.ClientID, js).Err()
            if err != nil {
              panic(err)
            }
            return
          }

          candidateString, err := json.Marshal(i.ToJSON())

          rReply := backendReply{
            Type:    "candidate",
            Payload: string(candidateString),
          }

          js, err := json.Marshal(rReply)
          if err != nil {
            panic(err)
          }

          rdb.Publish(ctx, request.ClientID, js).Err()
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
              }
            }
          }()

          fmt.Printf("Track has started, of type %d: %s \n", track.PayloadType(), track.Codec().MimeType)
          for {
            // Read RTP packets being sent to Pion
            rtp, _, readErr := track.ReadRTP()
            if readErr != nil {
              fmt.Println("ReadRTP error: ", readErr)
              return
              //panic(readErr)
            }

            if writeErr := trackLocals[request.ClientID].WriteRTP(rtp); writeErr != nil {
              fmt.Println("WriteRTP error: ", writeErr)
              return
              //panic(writeErr)
            }
          }
        })
        occupants, _ := rdb.HGet(ctx, request.RoomID, "occupants").Result()
        occupantsInfo := map[string]*peerInfo{}
        json.Unmarshal([]byte(occupants), &occupantsInfo)
        occupantsInfo[request.ClientID].IsPresent = true
        roomJSON, err := json.Marshal(occupantsInfo)
        if err != nil {
          panic(err)
        }
        rdb.HSet(ctx, request.RoomID, "occupants", roomJSON)
      }
      listLock.Unlock()

      offer := webrtc.SessionDescription{}
      if err := json.Unmarshal([]byte(request.Payload), &offer); err != nil {
        fmt.Println(err)
      }
      if err := peerMap[request.RoomID][request.ClientID].SetRemoteDescription(offer); err != nil {
        log.Println(err)
      }

      answer, err := peerMap[request.RoomID][request.ClientID].CreateAnswer(nil)
      if err != nil {
        panic(err)
      } else if err = peerMap[request.RoomID][request.ClientID].SetLocalDescription(answer); err != nil {
        panic(err)
      }

      answerString, err := json.Marshal(answer)
      if err != nil {
        panic(err)
      }

      rReply := backendReply{
        Type:    "answer",
        Payload: string(answerString),
      }

      js, err := json.Marshal(rReply)
      if err != nil {
        panic(err)
      }

      rdb.Publish(ctx, request.ClientID, js).Err()
    }
  }

}

func websocketHandler(w http.ResponseWriter, r *http.Request) {
    cookie, err := r.Cookie("visageUser")
  if err != nil {
    http.Error(w, "no user id", http.StatusInternalServerError)
  }

  userID := cookie.Value

  room, ok := r.URL.Query()["room"]

  if !ok || len(room[0]) < 1 {
    log.Println("Url Param 'room' is missing")
    http.Error(w, "no room specified", http.StatusInternalServerError)
  }

  roomID := room[0]

  log.Printf("WS connection for room: %s (user: %s)", roomID, userID)

  unsafeConn, err := upgrader.Upgrade(w, r, nil)
  if err != nil {
    log.Print("upgrade:", err)
    return
  }


  c := &threadSafeWriter{unsafeConn, sync.Mutex{}}

  defer c.Close()

  _ = c.WriteMessage(1, []byte("hello"))

  for {
    mt, message, err := c.ReadMessage()
    if err != nil {
      log.Println("read:", err)
      break
    }
    log.Printf("recv: %s", message)
    err = c.WriteMessage(mt, message)
    if err != nil {
      log.Println("write:", err)
      break
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

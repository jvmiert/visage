package main

import (
  "context"
  "encoding/json"
  "fmt"
  "log"
  "sync"
  "time"

  "github.com/go-redis/redis/v8"
  "github.com/pion/interceptor"
  "github.com/pion/rtcp"
  "github.com/pion/webrtc/v3"
)

var (
  ctx = context.Background()

  listLock    sync.RWMutex
  peerMap     map[string]map[string]*webrtc.PeerConnection
  trackLocals map[string]*webrtc.TrackLocalStaticRTP
  rtpSenders  map[string]*webrtc.RTPSender
)

// TODO: this needs to be shared between SFU and Backend.
// Might have to combine bot components into a single folder so we can export
// and import.
type SFURequest struct {
  Type     string
  ClientID string
  RoomID   string
  Payload  string
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

    case "answer":
      if _, present := peerMap[request.RoomID]; !present {
        //fmt.Println("Room not in peerMap (answer)")
        break
      }

      if _, present := peerMap[request.RoomID][request.ClientID]; !present {
        //fmt.Println("Peer not in peerMap (answer)")
        break
      }

      answer := webrtc.SessionDescription{}
      if err := json.Unmarshal([]byte(request.Payload), &answer); err != nil {
        fmt.Println(err)
      }
      if err := peerMap[request.RoomID][request.ClientID].SetRemoteDescription(answer); err != nil {
        fmt.Println(err)
      }
      //fmt.Println("set answer for: ", request.ClientID)

    case "create":
      peerConnection, err := api.NewPeerConnection(webrtc.Configuration{})

      if err != nil {
        fmt.Println(err)
        break
      }

      listLock.Lock()
      trackLocals[request.ClientID], err = webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: "video/vp8"}, "video", request.ClientID)
      if err != nil {
        panic(err)
      }

      rtpSenders[request.ClientID], err = peerConnection.AddTrack(trackLocals[request.ClientID])
      if err != nil {
        panic(err)
      }
      listLock.Unlock()

      go func() {
        rtcpBuf := make([]byte, 1500)
        for {
          if _, _, rtcpErr := rtpSenders[request.ClientID].Read(rtcpBuf); rtcpErr != nil {
            return
          }
        }
      }()

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
            panic(readErr)
          }

          if writeErr := trackLocals[request.ClientID].WriteRTP(rtp); writeErr != nil {
            panic(writeErr)
          }
        }
      })

      // for _, typ := range []webrtc.RTPCodecType{webrtc.RTPCodecTypeVideo, webrtc.RTPCodecTypeAudio} {
      //   if _, err := peerConnection.AddTransceiverFromKind(typ, webrtc.RTPTransceiverInit{
      //     Direction: webrtc.RTPTransceiverDirectionRecvonly,
      //   }); err != nil {
      //     fmt.Println(err)
      //     break
      //   }
      // }

      offer, err := peerConnection.CreateOffer(nil)
      if err != nil {
        fmt.Println(err)
        break
      }

      js, err := json.Marshal(offer)
      if err != nil {
        panic(err)
      }

      rdb.HSet(ctx, request.RoomID, "hostOffer", js)

      if err = peerConnection.SetLocalDescription(offer); err != nil {
        fmt.Println(err)
      }

      peerConnection.OnICECandidate(func(i *webrtc.ICECandidate) {
        if i == nil {
          err = rdb.Publish(ctx, request.RoomID, "done").Err()
          if err != nil {
            panic(err)
          }
          return
        }

        js, err := json.Marshal(i.ToJSON())
        if err != nil {
          panic(err)
        }

        rdb.HSet(ctx, request.RoomID, "hostOfferCandidates", js)
      })

      listLock.Lock()
      if _, present := peerMap[request.RoomID]; !present {
        peerMap[request.RoomID] = make(map[string]*webrtc.PeerConnection)
      }
      peerMap[request.RoomID][request.ClientID] = peerConnection
      listLock.Unlock()
    }
  }

}

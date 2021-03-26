package main

import (
  "context"
  "encoding/json"
  "fmt"
  "time"

  "github.com/go-redis/redis/v8"
  "github.com/pion/interceptor"
  "github.com/pion/webrtc/v3"
)

var ctx = context.Background()

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
  fmt.Println("hello let's start a Redis subscription...")

  rdb := redis.NewClient(&redis.Options{
    Addr:     "localhost:6379",
    Password: "",
    DB:       0,
  })

  s := webrtc.SettingEngine{}
  s.SetNAT1To1IPs([]string{"127.0.0.1"}, webrtc.ICECandidateTypeHost)
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

  pubsub := rdb.Subscribe(ctx, "sfu_info")

  ch := pubsub.Channel()

  for msg := range ch {
    var request SFURequest
    err := json.Unmarshal([]byte(msg.Payload), &request)

    if err != nil {
      fmt.Println("Couldn't decode message...")
      return
    }

    switch request.Type {
    case "answer":
      fmt.Println(request.Payload)
    case "create":
      /*
         @TODO:
           - Add to peer track hashmap with mutex
           - Return offer to backend
       **/
      peerConnection, err := api.NewPeerConnection(webrtc.Configuration{})

      if err != nil {
        fmt.Println(err)
        return
      }

      for _, typ := range []webrtc.RTPCodecType{webrtc.RTPCodecTypeVideo, webrtc.RTPCodecTypeAudio} {
        if _, err := peerConnection.AddTransceiverFromKind(typ, webrtc.RTPTransceiverInit{
          Direction: webrtc.RTPTransceiverDirectionRecvonly,
        }); err != nil {
          fmt.Println(err)
          return
        }
      }

      offer, err := peerConnection.CreateOffer(nil)
      if err != nil {
        fmt.Println(err)
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

      f := func() {
        peerConnection.Close()
      }

      time.AfterFunc(10*time.Second, f)
    }
  }

}

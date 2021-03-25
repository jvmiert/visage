package main

import (
  "context"
  "fmt"
  "time"

  "github.com/go-redis/redis/v8"
  "github.com/pion/interceptor"
  "github.com/pion/webrtc/v3"
)

var ctx = context.Background()

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
    fmt.Println(msg.Channel, msg.Payload)

    /*
       @TODO:
         - Receive peer creation message
         - Create peer
         - Add to peer track hashmap with mutex
         - Return offer to backend


     **/

    switch msg.Payload {
    case "test":
      fmt.Println("  Creating a peer...")

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

      if err = peerConnection.SetLocalDescription(offer); err != nil {
        fmt.Println(err)
      }

      peerConnection.OnICECandidate(func(i *webrtc.ICECandidate) {
        if i == nil {
          fmt.Println("Done with candidate gathering")
          return
        }

        fmt.Println(i)
      })

      f := func() {
        peerConnection.Close()
      }

      time.AfterFunc(10*time.Second, f)

    }
  }

}

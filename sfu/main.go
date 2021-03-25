package main

import (
  "context"
  "fmt"
  "time"
  "github.com/go-redis/redis/v8"
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


  pubsub := rdb.Subscribe(ctx, "sfu_info")

  ch := pubsub.Channel()

  for msg := range ch {
      fmt.Println(msg.Channel, msg.Payload)
      switch msg.Payload {
      case "test":
        fmt.Println("  Creating a peer...")
        s := webrtc.SettingEngine{}
        s.SetNAT1To1IPs([]string{"172.0.0.1"}, webrtc.ICECandidateTypeHost)
        s.SetLite(true)

        mediaEngine := webrtc.MediaEngine{}
        mediaEngine.RegisterDefaultCodecs()

        api := webrtc.NewAPI(webrtc.WithSettingEngine(s), webrtc.WithMediaEngine(&mediaEngine))
         
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

        //fmt.Println(offer)

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
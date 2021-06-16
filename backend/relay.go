package main

import (
  "context"
  "fmt"
  "sync"

  "github.com/go-redis/redis/v8"
  "github.com/pion/ion-sfu/pkg/relay"
  "github.com/pion/webrtc/v3"
)

const (
  redisSubscriberPrefix = "node_sub_"
)

type RelayManager struct {
  SFU    *SFUServer
  Relays map[string]*relay.Peer
  sync.Mutex
}

func (r *RelayManager) signalFn(meta relay.PeerMeta, signal []byte) ([]byte, error) {
  fmt.Println("\033[35m", "Got signalFn call meta: ", meta, "\033[0m")

  /*

     TODO:
       - Send signal over redis
       - Listen for relay peer Answer() return and return that value

      **/

  return nil, ErrNotImplemented
}

func (r *RelayManager) StartRelay(sessionID string, nodeID string) error {
  fmt.Println("\033[35m RELAY needed from:", r.SFU.nodeID, "TO", nodeID, "\033[0m")
  peer, err := r.SFU.sessionManager.GetSessionPeer(sessionID)

  relayPeer, err := peer.Publisher().Relay([]webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}})
  if err != nil {
    return err
  }

  err = relayPeer.Offer(r.signalFn)
  if err != nil {
    return err
  }

  /*

     TODO:
       - Save relay peer

      **/

  return nil
}

func (r *RelayManager) StartListening() error {
  subChannel := redisSubscriberPrefix + r.SFU.nodeID
  logger.Info("Start subscribing for node events", "channel", subChannel)
  fmt.Println("Starting redis sub....")

  var subCtx = context.Background()
  var subClient = redis.NewClient(&redis.Options{
    Addr: "localhost:6379",
  })

  pubsub := subClient.Subscribe(subCtx, subChannel)

  ch := pubsub.Channel()

  /*

     TODO:
       - Listen for signalFn signal message
       - Create a new peer
       - Join peer to room
       - Start relay of above peer and pass above signal message to answer function
       - Send above return value over Redis so signalFn can receive it
       - Save new peer and relay peer so we can cleanup

      **/

  for msg := range ch {
    fmt.Println(msg.Channel, msg.Payload)
  }

  return nil
}

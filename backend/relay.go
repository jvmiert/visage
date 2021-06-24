package main

import (
  "context"
  "encoding/json"
  "fmt"
  "sync"
  "time"

  "github.com/go-redis/redis/v8"
  "github.com/pion/ion-sfu/pkg/relay"
  "github.com/pion/webrtc/v3"
)

const (
  redisSubscriberPrefix = "node_sub_"
  relayOffer            = 0
  relayAnswer           = 1
)

type RelayManager struct {
  SFU              *SFUServer
  LocalRelays      map[string]*relay.Peer
  signalTargetNode string
  sync.Mutex
}

type RelaySignal struct {
  SignalType    int            `json:"signalType"`
  SignalContent []byte         `json:"signalContent"`
  SignalMeta    relay.PeerMeta `json:"signalMeta"`
  SourceNode    string         `json:"sourceNode"`
}

func NewRelayManager(s *SFUServer) (*RelayManager, error) {
  r := &RelayManager{
    LocalRelays: make(map[string]*relay.Peer),
    SFU:         s,
  }

  return r, nil
}

func (r *RelayManager) isRelayActive(sessionID string, nodeID string) (bool, error) {
  relayKey := sessionID + "_" + nodeID
  if _, present := r.LocalRelays[relayKey]; present {
    return true, nil
  }
  return false, nil
}

func (r *RelayManager) signalOffer(meta relay.PeerMeta, signal []byte) ([]byte, error) {
  fmt.Println("\033[35m", "Got signalOffer call meta: ", meta, " | Node:", r.signalTargetNode, "\033[0m")

  signalOffer := &RelaySignal{
    SignalType:    relayOffer,
    SignalContent: signal,
    SignalMeta:    meta,
    SourceNode:    r.SFU.nodeID,
  }

  sMars, err := json.Marshal(signalOffer)
  if err != nil {
    fmt.Println("Marshal error for signalOffer: ", err)
    return nil, err
  }

  subChannel := redisSubscriberPrefix + r.signalTargetNode

  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()

  err = r.SFU.rClient.Publish(ctx, subChannel, sMars).Err()
  if err != nil {
    return nil, err
  }

  ch, err := r.StartListening()
  var signalAnswer *RelaySignal

  for msg := range ch {
    err := json.Unmarshal([]byte(msg.Payload), &signalAnswer)
    if err != nil {
      fmt.Println("Unmarshal error during relay answer handle")
      continue
    }

    if signalAnswer.SignalType != relayAnswer {
      continue
    }

    if signalAnswer.SignalMeta.SessionID != meta.SessionID {
      continue
    }

    fmt.Println("\033[35m", "Got signalANSWER for meta: ", signalAnswer.SignalMeta.SessionID, "\033[0m")
    break
  }

  return signalAnswer.SignalContent, nil
}

func (r *RelayManager) StartRelay(sessionID string, nodeID string) error {
  fmt.Println("\033[35m RELAY needed from:", r.SFU.nodeID, "TO", nodeID, "\033[0m")
  peer, err := r.SFU.sessionManager.GetSessionPeer(sessionID)
  if err != nil {
    fmt.Println("\033[35m", "ERROR in GetSessionPeer function: ", err, "\033[0m")
    return err
  }

  r.Lock()
  r.signalTargetNode = nodeID

  var iceServers []webrtc.ICEServer
  relayPeer, err := peer.Publisher().Relay(iceServers)
  if err != nil {
    fmt.Println("\033[35m", "ERROR in Relay function: ", err, "\033[0m")
    return err
  }

  r.Unlock()

  relayKey := sessionID + "_" + nodeID
  r.LocalRelays[relayKey] = relayPeer

  // err = relayPeer.Offer(func(meta relay.PeerMeta, signal []byte) ([]byte, error) {
  //   fmt.Println("\033[35m", "CALLING OFFER FUNCTION!!!", "\033[0m")
  //   answer, err := r.signalOffer(nodeID, meta, signal)
  //   if err != nil {
  //     fmt.Println("\033[35m", "ERROR in offer function: ", err, "\033[0m")
  //     return nil, err
  //   }
  //   return answer, nil
  // })

  // if err != nil {
  //   return err
  // }

  /*

     TODO:
       - Save relay peer

      **/

  return nil
}

func (r *RelayManager) StartListening() (<-chan *redis.Message, error) {
  subChannel := redisSubscriberPrefix + r.SFU.nodeID
  logger.Info("Start subscribing for node events", "channel", subChannel)
  fmt.Println("Starting redis sub....")

  var subCtx = context.Background()
  var subClient = redis.NewClient(&redis.Options{
    Addr: "localhost:6379",
  })

  pubsub := subClient.Subscribe(subCtx, subChannel)

  ch := pubsub.Channel()

  return ch, nil
}

func (r *RelayManager) HandleOffer(ch <-chan *redis.Message) error {
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
    var signalOffer *RelaySignal
    err := json.Unmarshal([]byte(msg.Payload), &signalOffer)
    if err != nil {
      fmt.Println("Unmarshal error during relay answer handle")
      continue
    }

    if signalOffer.SignalType != relayOffer {
      continue
    }

    fmt.Println("\033[35m", "HANDELING OFFER FOR PEER: ", signalOffer.SignalMeta.PeerID, "\033[0m")

    var iceServers []webrtc.ICEServer

    _, cfg := r.SFU.SFU.GetSession(signalOffer.SignalMeta.SessionID)

    newPeer, err := relay.NewPeer(relay.PeerMeta{
      PeerID:    signalOffer.SignalMeta.PeerID,
      SessionID: signalOffer.SignalMeta.SessionID,
    }, &relay.PeerConfig{
      SettingEngine: cfg.Setting,
      ICEServers:    iceServers,
      Logger:        logger,
    })

    if err != nil {
      fmt.Println("HandleOffer NewPeer error:", err)
      continue
    }

    answer, err := newPeer.Answer(signalOffer.SignalContent)

    if err != nil {
      fmt.Println("New relay peer answer errror:", err)
      continue
    }

    SignalAnswer := &RelaySignal{
      SignalType:    relayAnswer,
      SignalContent: answer,
      SignalMeta:    signalOffer.SignalMeta,
      SourceNode:    r.SFU.nodeID,
    }

    sMars, err := json.Marshal(SignalAnswer)
    if err != nil {
      fmt.Println("Marshal error for SignalAnswer: ", err)
      continue
    }

    subChannel := redisSubscriberPrefix + signalOffer.SourceNode

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    err = r.SFU.rClient.Publish(ctx, subChannel, sMars).Err()
    if err != nil {
      continue
    }
  }

  return nil
}

package main

import (
  "encoding/json"
  "fmt"
  "sync"
  "time"

  "github.com/go-redis/redis/v8"
  "github.com/pion/ion-sfu/pkg/sfu"
)

const (
  sessionRedisKeyPrefix = "session_"
)

type UserSession struct {
  peer   *sfu.PeerLocal
  RoomID string `json:"roomID"`
  UserID string `json:"userID"`
  Region string `json:"region"`
  Node   string `json:"node"`
}

type Sessions struct {
  SFU      *SFUServer
  Sessions map[string]*UserSession
  sync.Mutex
}

func (s *UserSession) UpdateRoom(roomName string, sessionID string) error {
  s.RoomID = roomName

  sMars, err := json.Marshal(s)
  if err != nil {
    fmt.Println("(UpdateRoom) Marshal error for session: ", sessionID)
    return err
  }

  err = RClient.Set(ctx, sessionRedisKeyPrefix+sessionID, sMars, 24*time.Hour).Err()
  if err != nil {
    fmt.Println("(UpdateRoom) Error while saving session: ", sessionID)
    return err
  }

  return nil
}

func (s *Sessions) CheckRelayNeed(sessionID string, roomID string) error {
  s.Lock()
  defer s.Unlock()

  if _, ok := s.Sessions[sessionID]; ok {
    session := *s.Sessions[sessionID]

    s.Sessions[sessionID].RoomID = roomID

    r := &Room{
      Uid: roomID,
    }

    r.Lock()
    defer r.Unlock()

    r.RetrieveRedis()

    var nodesPresent = map[string]bool{
      session.Node: true,
    }

    for userSession, user := range r.Users {
      if _, present := nodesPresent[user.NodeID]; !present {
        s.SFU.relayManager.StartRelay(userSession, user.NodeID)
        _ = userSession
        nodesPresent[user.NodeID] = true
      }
    }
    return nil
  }

  return ErrSessionNotFound
}

func (s *Sessions) DeleteSession(sessionID string) error {
  s.Lock()
  delete(s.Sessions, sessionID)
  s.Unlock()

  err := RClient.Del(ctx, sessionRedisKeyPrefix+sessionID).Err()
  if err != nil {
    fmt.Println("Couldn't delete session: ", sessionID)
    return err
  }

  return nil
}

func (s *Sessions) CreateSession(sessionID string, userID string) error {
  userSession := &UserSession{
    UserID: userID,
    Region: s.SFU.nodeRegion,
    Node:   s.SFU.nodeID,
  }

  s.Lock()
  s.Sessions[sessionID] = userSession
  s.Unlock()

  sMars, err := json.Marshal(userSession)
  if err != nil {
    fmt.Println("Marshal error for session: ", sessionID)
    return err
  }

  err = RClient.Set(ctx, sessionRedisKeyPrefix+sessionID, sMars, 24*time.Hour).Err()
  if err != nil {
    fmt.Println("Error while saving session: ", sessionID)
    return err
  }

  return nil
}

func (s *Sessions) AddPeer(sessionID string, peer *sfu.PeerLocal) error {
  s.Lock()
  defer s.Unlock()

  if _, ok := s.Sessions[sessionID]; ok {
    s.Sessions[sessionID].peer = peer
    return nil
  }

  return ErrSessionNotFound
}

func (s *Sessions) RemovePeer(sessionID string) error {
  s.Lock()
  defer s.Unlock()

  if _, ok := s.Sessions[sessionID]; ok {
    if s.Sessions[sessionID].peer != nil {
      s.Sessions[sessionID].peer.Close()
      s.Sessions[sessionID].peer = nil
      return nil
    }
    return nil
  }

  return ErrSessionNotFound
}

func (s *Sessions) GetSessionPeer(sessionID string) (*sfu.PeerLocal, error) {
  s.Lock()
  defer s.Unlock()

  if _, ok := s.Sessions[sessionID]; ok {
    if s.Sessions[sessionID].peer == nil {
      return nil, ErrSessionPeerNotSet
    } else {
      return s.Sessions[sessionID].peer, nil
    }
  }

  return nil, ErrSessionNotFound
}

func (s *Sessions) CleanSessions() error {
  s.Lock()
  defer s.Unlock()

  for sessionID, session := range s.Sessions {
    r := &Room{
      Uid: session.RoomID,
    }

    r.RemoveUser(sessionID)

    RClient.Del(ctx, sessionRedisKeyPrefix+sessionID)
  }

  return nil
}

func GetSession(sessionID string) (*UserSession, error) {
  sessionRaw, err := RClient.Get(ctx, sessionRedisKeyPrefix+sessionID).Result()

  if err == redis.Nil {
    fmt.Println("Session not found: ", sessionID)
    return nil, ErrSessionNotFound
  }

  if err != nil {
    fmt.Println("Redis error while getting session: ", sessionID)
    return nil, err
  }

  var session *UserSession
  err = json.Unmarshal([]byte(sessionRaw), &session)
  if err != nil {
    fmt.Println("UserSession unmarshal error")
    return nil, err
  }

  return session, nil
}

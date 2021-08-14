package main

import (
  "context"
  "encoding/json"
  "fmt"
  "time"

  "github.com/go-redis/redis/v8"
  "github.com/go-redsync/redsync/v4"
  "github.com/go-redsync/redsync/v4/redis/goredis/v8"
)

const (
  roomRedisKeyPrefix = "room_"
  roomMutexKeyPrefix = "rmutex_"
)

type Room struct {
  Uid        string               `json:"uid"`
  IsPublic   bool                 `json:"isPublic,omitempty"`
  Users      map[string]*UserInfo `json:"Users"`
  Nodes      map[string]struct{}  `json:"Nodes"`
  LastActive int64                `json:"lastActive"`
  mutex      *redsync.Mutex
  rClient    *redis.Client
}

type TokenInfo struct {
  Room string `json:"room"`
  User string `json:"user"`
}

func makeRoom(uid string, public bool, RClient *redis.Client) (*Room, error) {
  r := &Room{
    Uid:        uid,
    IsPublic:   public,
    Users:      make(map[string]*UserInfo),
    Nodes:      make(map[string]struct{}),
    LastActive: time.Now().Unix(),
    rClient:    RClient,
  }

  r.Lock()
  defer r.Unlock()

  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()

  err := RClient.HGet(ctx, roomRedisKeyPrefix+uid, "info").Err()

  if err == nil {
    fmt.Println("Tried to make room but already exists: ", uid)
    return nil, ErrRoomExists
  }

  err = r.SaveRoom()

  if err != nil {
    return nil, err
  }

  return r, nil
}

func getRoomfromToken(token string, RClient *redis.Client) (*Room, string, error) {
  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()

  tokenInfo, err := RClient.Get(ctx, token).Result()

  if err == redis.Nil {
    fmt.Println("TokenInfo not found: ", token)
    return nil, "", ErrRoomNotFound
  }

  if err != nil {
    fmt.Println("Redis error while getting TokenInfo: ", token)
    return nil, "", err
  }

  var t *TokenInfo
  err = json.Unmarshal([]byte(tokenInfo), &t)
  if err != nil {
    fmt.Println("Unmarshal error while getting TokenInfo")
    return nil, "", err
  }

  err = RClient.Del(ctx, token).Err()
  if err != nil {
    fmt.Println("Couldn't delete join token: ", token)
    return nil, "", err
  }

  r := &Room{
    Uid:     t.Room,
    rClient: RClient,
  }

  r.Lock()
  defer r.Unlock()

  err = r.RetrieveRedis()

  if err != nil {
    return nil, "", err
  }

  return r, t.User, nil
}

func AddUserToRoom(roomID string, sessionID string, s *SFUServer) (string, error) {
  r := &Room{
    Uid:     roomID,
    rClient: s.rClient,
  }

  r.Lock()
  defer r.Unlock()

  err := r.RetrieveRedis()

  if err != nil {
    return "", err
  }

  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()

  count, err := s.rClient.HIncrBy(ctx, roomRedisKeyPrefix+r.Uid, "count", 1).Result()

  if err != nil {
    fmt.Println("Error while incrementing user in room: ", r.Uid)
    return "", err
  }

  if count > 12 {
    return "", ErrRoomFull
  }

  session, err := s.sessionManager.GetSession(sessionID)

  if err != nil {
    fmt.Println("Error while getting session in room: ", r.Uid)
    return "", err
  }

  err = session.UpdateRoom(roomID, sessionID)

  if err != nil {
    fmt.Println("Error while changing session room info: ")
    return "", err
  }

  userInfo := &UserInfo{
    Uid:       session.UserID,
    SessionID: sessionID,
    Region:    session.Region,
    NodeID:    session.Node,
  }

  r.Users[sessionID] = userInfo

  r.Nodes[session.Node] = struct{}{}

  err = r.SaveRoom()
  if err != nil {
    return "", err
  }
  token, err := r.MakeToken(userInfo)

  if err != nil {
    return "", err
  }
  return token, nil
}

func (r *Room) MakeToken(userInfo *UserInfo) (string, error) {
  token, err := GenerateRandomString(128)

  if err != nil {
    return "", err
  }

  t := &TokenInfo{
    Room: r.Uid,
    User: userInfo.Uid,
  }

  tMars, err := json.Marshal(t)
  if err != nil {
    fmt.Println("Marshal error for TokenInfo: ", userInfo.Uid, r.Uid)
    return "", err
  }

  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()

  err = r.rClient.Set(ctx, token, tMars, 1*time.Hour).Err()
  if err != nil {
    return "", err
  }

  return token, nil
}

func (r *Room) RemoveUser(sessionID string) error {
  r.Lock()
  defer r.Unlock()

  err := r.RetrieveRedis()

  if err != nil {
    return err
  }

  delete(r.Users, sessionID)

  newNodes := make(map[string]struct{})
  for _, user := range r.Users {
    newNodes[user.NodeID] = struct{}{}
  }

  r.Nodes = newNodes

  err = r.SaveRoom()
  if err != nil {
    return err
  }

  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()

  err = r.rClient.HSet(ctx, roomRedisKeyPrefix+r.Uid, "count", len(r.Users)).Err()
  if err != nil {
    return err
  }
  return nil
}

func (r *Room) SaveRoom() error {
  r.EnsureLock()

  r.LastActive = time.Now().Unix()

  rMars, err := json.Marshal(r)
  if err != nil {
    fmt.Println("Marshal error for room: ", r.Uid)
    return err
  }

  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()

  err = r.rClient.HSet(ctx, roomRedisKeyPrefix+r.Uid, "info", rMars).Err()
  if err != nil {
    fmt.Println("Error while updating room: ", r.Uid)
    return err
  }

  r.rClient.Expire(ctx, roomRedisKeyPrefix+r.Uid, 24*time.Hour).Err()
  if err != nil {
    fmt.Println("Error while updating room: ", r.Uid)
    return err
  }

  return nil
}

func (r *Room) RetrieveRedis() error {
  r.EnsureLock()

  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()

  room, err := r.rClient.HGet(ctx, roomRedisKeyPrefix+r.Uid, "info").Result()

  if err == redis.Nil {
    fmt.Println("Room not found: ", r.Uid)
    return ErrRoomNotFound
  }

  if err != nil {
    fmt.Println("Redis error while getting room: ", r.Uid)
    return err
  }

  err = json.Unmarshal([]byte(room), &r)
  if err != nil {
    fmt.Println("Unmarshal error while unmars room: ", r.Uid)
    return err
  }

  r.rClient.Expire(ctx, roomRedisKeyPrefix+r.Uid, 24*time.Hour)

  return nil
}

func (r *Room) EnsureLock() {
  if r.mutex == nil {
    r.Lock()
  }
}

func (r *Room) Lock() error {
  if r.mutex == nil {

    pool := goredis.NewPool(r.rClient)
    rs := redsync.New(pool)

    r.mutex = rs.NewMutex(roomMutexKeyPrefix+r.Uid, redsync.WithExpiry(5*time.Second), redsync.WithTries(50))
  }
  mutex_ctx := context.Background()
  if err := r.mutex.LockContext(mutex_ctx); err != nil {
    return err
  }
  return nil
}

func (r *Room) Unlock() error {
  mutex_ctx := context.Background()
  if _, err := r.mutex.UnlockContext(mutex_ctx); err != nil {
    return err
  }
  r.mutex = nil
  return nil
}

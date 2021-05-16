package main

import (
  "encoding/json"
  "fmt"
  "sync"
  "time"

  "github.com/go-redis/redis/v8"
)

const (
  roomRedisKeyPrefix = "room_"
)

type Room struct {
  sync.RWMutex
  Uid        string           `json:"uid"`
  IsPublic   bool             `json:"isPublic,omitempty"`
  Users      map[string]*User `json:"Users"`
  LastActive int64            `json:"lastActive"`
}

type TokenInfo struct {
  Room string `json:"room"`
  User string `json:"user"`
}

func makeRoom(uid string, public bool) (*Room, error) {
  rdb := RClient()

  err := rdb.HGet(ctx, roomRedisKeyPrefix+uid, "info").Err()

  if err == nil {
    fmt.Println("Tried to make room but already exists: ", uid)
    return nil, ErrRoomExists
  }

  r := &Room{
    Uid:        uid,
    IsPublic:   public,
    Users:      make(map[string]*User),
    LastActive: time.Now().Unix(),
  }

  rMars, err := json.Marshal(r)
  if err != nil {
    fmt.Println("Marshal error for room: ", uid)
    return nil, err
  }
  err = rdb.HSet(ctx, roomRedisKeyPrefix+uid, "info", rMars).Err()

  if err != nil {
    return nil, err
  }

  rdb.Expire(ctx, roomRedisKeyPrefix+uid, 24*time.Hour)

  return r, nil
}

func getRoom(uid string) (*Room, error) {
  rdb := RClient()

  room, err := rdb.HGet(ctx, roomRedisKeyPrefix+uid, "info").Result()

  if err == redis.Nil {
    fmt.Println("Room not found: ", uid)
    return nil, ErrRoomNotFound
  }

  if err != nil {
    fmt.Println("Redis error while getting room: ", uid)
    return nil, err
  }

  var r *Room
  err = json.Unmarshal([]byte(room), &r)
  if err != nil {
    fmt.Println("Unmarshal error while getting room: ", uid)
    return nil, err
  }

  rdb.Expire(ctx, roomRedisKeyPrefix+uid, 24*time.Hour)

  return r, nil
}

func getRoomfromToken(token string) (*Room, string, error) {
  rdb := RClient()

  tokenInfo, err := rdb.Get(ctx, token).Result()

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

  room, err := rdb.HGet(ctx, roomRedisKeyPrefix+t.Room, "info").Result()

  if err == redis.Nil {
    fmt.Println("Room not found: ", t.Room)
    return nil, "", ErrRoomNotFound
  }

  if err != nil {
    fmt.Println("Redis error while getting room: ", t.Room)
    return nil, "", err
  }

  var r *Room
  err = json.Unmarshal([]byte(room), &r)
  if err != nil {
    fmt.Println("Unmarshal error while getting room: ", t.Room)
    return nil, "", err
  }

  rdb.Expire(ctx, roomRedisKeyPrefix+t.Room, 24*time.Hour)

  return r, t.User, nil
}

func (r *Room) AddUser(user *User) (string, error) {
  r.Lock()
  defer r.Unlock()

  if r.Uid == user.ActiveRoom {
    token, err := r.MakeToken(user)

    if err != nil {
      return "", err
    }
    return token, nil
  }

  if user.ActiveRoom != "" {
    return "", ErrUserInRoom
  }

  rdb := RClient()
  count, err := rdb.HIncrBy(ctx, roomRedisKeyPrefix+r.Uid, "count", 1).Result()

  if err != nil {
    fmt.Println("Error while incrementing user in room: ", r.Uid)
    return "", err
  }

  if count > 4 {
    return "", ErrRoomFull
  }

  r.Users[user.Uid] = user
  user.ActiveRoom = r.Uid
  err = user.SaveUser()
  if err != nil {
    return "", err
  }
  err = r.SaveRoom()
  if err != nil {
    return "", err
  }
  token, err := r.MakeToken(user)

  if err != nil {
    return "", err
  }
  return token, nil
}

func (r *Room) MakeToken(user *User) (string, error) {
  rdb := RClient()
  token, err := GenerateRandomString(128)

  if err != nil {
    return "", err
  }

  t := &TokenInfo{
    Room: r.Uid,
    User: user.Uid,
  }

  tMars, err := json.Marshal(t)
  if err != nil {
    fmt.Println("Marshal error for TokenInfo: ", user.Uid, r.Uid)
    return "", err
  }

  err = rdb.Set(ctx, token, tMars, 1*time.Hour).Err()
  if err != nil {
    return "", err
  }

  return token, nil
}

func (r *Room) RemoveUser(user *User) error {
  r.Lock()
  defer r.Unlock()

  if user.ActiveRoom == "" {
    return nil
  }

  delete(r.Users, user.Uid)
  user.ActiveRoom = ""
  err := user.SaveUser()
  if err != nil {
    return err
  }
  err = r.SaveRoom()
  if err != nil {
    return err
  }
  rdb := RClient()
  err = rdb.HSet(ctx, roomRedisKeyPrefix+r.Uid, "count", len(r.Users)).Err()
  if err != nil {
    return err
  }
  return nil
}

func (r *Room) SaveRoom() error {
  rdb := RClient()

  r.LastActive = time.Now().Unix()

  rMars, err := json.Marshal(r)
  if err != nil {
    fmt.Println("Marshal error for room: ", r.Uid)
    return err
  }

  err = rdb.HSet(ctx, roomRedisKeyPrefix+r.Uid, "info", rMars).Err()
  if err != nil {
    fmt.Println("Error while updating room: ", r.Uid)
    return err
  }
  return nil
}

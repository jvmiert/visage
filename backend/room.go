package main

import (
  "encoding/json"
  "fmt"
  "sync"

  "github.com/go-redis/redis/v8"
)

const (
  roomRedisKeyPrix = "room_"
)

type Room struct {
  sync.RWMutex
  Uid      string           `json:"uid"`
  IsPublic bool             `json:"isPublic,omitempty"`
  Users    map[string]*User `json:"Users"`
}

func makeRoom(uid string, public bool) (*Room, error) {
  rdb := RClient()

  err := rdb.HGet(ctx, roomRedisKeyPrix+uid, "info").Err()

  if err == nil {
    fmt.Println("Tried to make room but already exists: ", uid)
    return nil, ErrRoomExists
  }

  r := &Room{
    Uid:      uid,
    IsPublic: public,
    Users:    make(map[string]*User),
  }

  rMars, err := json.Marshal(r)
  if err != nil {
    fmt.Println("Marshal error for room: ", uid)
    return nil, err
  }
  err = rdb.HSet(ctx, roomRedisKeyPrix+uid, "info", rMars).Err()

  if err != nil {
    return nil, err
  }

  return r, nil
}

func getRoom(uid string) (*Room, error) {
  rdb := RClient()

  room, err := rdb.HGet(ctx, roomRedisKeyPrix+uid, "info").Result()

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

  return r, nil
}

func (r *Room) AddUser(user *User) error {
  r.Lock()
  defer r.Unlock()

  if r.Uid == user.ActiveRoom {
    return nil
  }

  if user.ActiveRoom != "" {
    return ErrUserInRoom
  }

  rdb := RClient()
  count, err := rdb.HIncrBy(ctx, roomRedisKeyPrix+r.Uid, "count", 1).Result()

  if err != nil {
    fmt.Println("Error while incrementing user in room: ", r.Uid)
    return err
  }

  if count > 4 {
    return ErrRoomFull
  }

  r.Users[user.Uid] = user
  user.ActiveRoom = r.Uid
  err = user.SaveUser()
  if err != nil {
    return err
  }
  err = r.SaveRoom()
  if err != nil {
    return err
  }
  return nil
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
  err = rdb.HSet(ctx, roomRedisKeyPrix+r.Uid, "count", len(r.Users)).Err()
  if err != nil {
    return err
  }
  return nil
}

func (r *Room) SaveRoom() error {
  rdb := RClient()

  rMars, err := json.Marshal(r)
  if err != nil {
    fmt.Println("Marshal error for room: ", r.Uid)
    return err
  }

  err = rdb.HSet(ctx, roomRedisKeyPrix+r.Uid, "info", rMars).Err()
  if err != nil {
    fmt.Println("Error while updating room: ", r.Uid)
    return err
  }
  return nil
}

package main

import (
  "encoding/json"
  "fmt"

  "github.com/go-redis/redis/v8"
)

const (
  userRedisKeyPrefix = "user_"
)

type User struct {
  Uid        string `json:"uid"`
  ActiveRoom string `json:"activeRoom,omitempty"`
  Region     string `json:"region"`
  NodeID     string `json:"nodeID"`
}

func getOrMakeUser(uid string) *User {
  u, err := getUser(uid)
  if err == nil {
    return u
  }
  u, err = makeUser(uid)
  if err == nil {
    return u
  } else {
    panic(err)
  }
}

func makeUser(uid string) (*User, error) {
  rdb := RClient()

  err := rdb.Get(ctx, userRedisKeyPrefix+uid).Err()

  if err == nil {
    fmt.Println("Tried to make user but already exists: ", uid)
    return nil, ErrUserExists
  }

  u := &User{
    Uid: uid,
  }

  uMars, err := json.Marshal(u)
  if err != nil {
    fmt.Println("Marshal error for user: ", uid)
    return nil, err
  }
  err = rdb.Set(ctx, userRedisKeyPrefix+uid, uMars, 0).Err()

  if err != nil {
    return nil, err
  }

  return u, nil
}

func getUser(uid string) (*User, error) {
  rdb := RClient()

  user, err := rdb.Get(ctx, userRedisKeyPrefix+uid).Result()

  if err == redis.Nil {
    fmt.Println("User not found: ", uid)
    return nil, ErrUserNotFound
  }

  if err != nil {
    fmt.Println("Redis error while getting user: ", uid)
    return nil, err
  }

  var u *User
  err = json.Unmarshal([]byte(user), &u)
  if err != nil {
    fmt.Println("Unmarshal error while getting user: ", uid)
    return nil, err
  }

  return u, nil
}

func NewUid() string {
  ret, _ := GenerateRandomString(128)

  return ret
}

func (u *User) SaveUser() error {
  rdb := RClient()

  uMars, err := json.Marshal(u)
  if err != nil {
    fmt.Println("Marshal error for user: ", u.Uid)
    return err
  }

  err = rdb.Set(ctx, userRedisKeyPrefix+u.Uid, uMars, 0).Err()
  if err != nil {
    fmt.Println("Error while updating user: ", u.Uid)
    return err
  }
  return nil
}

func (u *User) Leave() error {
  if u.ActiveRoom == "" {
    return nil
  }

  room, err := getRoom(u.ActiveRoom)

  err = room.RemoveUser(u)

  if err != nil {
    return err
  }

  return nil
}

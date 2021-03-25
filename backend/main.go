package main

import (
  "context"
  "encoding/json"
  "fmt"
  "net/http"
  "strings"
  "visage/backend/connections"

  "github.com/go-redis/redis/v8"
  "github.com/google/uuid"
  "github.com/gorilla/mux"
)

var ctx = context.Background()

type replyMessage struct {
  Joinable bool
  IsHost   bool
}

type key int

const (
  keyUserID key = iota
)

func joinRoom(w http.ResponseWriter, r *http.Request) {
  params := mux.Vars(r)
  room := params["room"]

  client := connections.RClient()
  val, err := client.Get(ctx, room).Result()
  switch {
  case err == redis.Nil:
    http.Error(w, "room doesn't exist", http.StatusNotFound)
    return
  case err != nil:
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  case val == "":
    http.Error(w, "bad request", http.StatusBadRequest)
    return
  }

  occupyCount, err := client.Incr(ctx, room).Result()

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  // for now we don't limit this yet
  /*
     if occupyCount > 2 {
       m := replyMessage{false}
       js, err := json.Marshal(m)
       if err != nil {
         http.Error(w, err.Error(), http.StatusInternalServerError)
         return
       }
       w.Header().Set("Content-Type", "application/json")
       w.Write(js)
       return

     }
  */

  if occupyCount > 1 {
    m := replyMessage{true, false}
    js, err := json.Marshal(m)

    if err != nil {
      http.Error(w, err.Error(), http.StatusInternalServerError)
      return
    }

    w.Header().Set("Content-Type", "application/json")
    w.Write(js)
    return
  }

  m := replyMessage{true, true}
  js, err := json.Marshal(m)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func createRoom(w http.ResponseWriter, r *http.Request) {
  fmt.Println(r.Context().Value(keyUserID))

  id, err := uuid.NewRandom()

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  channelID := strings.ReplaceAll(id.String(), "-", "")

  client := connections.RClient()
  val, err := client.HIncrBy(ctx, channelID, "occupancyCount", 1).Result()

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  if val > 1 {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  js, err := json.Marshal(channelID)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  /*
     @TODO:
       - Set host uuid in redis
       - Publish peer creation message to SFU with room id
       - Receive SDP offer made in return an signal ready to peer
       - Redirect to join room as host
   **/

  pubsub := client.Subscribe(ctx, "test")
  ch := pubsub.Channel()

awaitLoop:
  for msg := range ch {
    switch msg.Payload {
    case "done":
      fmt.Println("Got test message...")
      break awaitLoop
    }
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func addContext(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    var userID string
    cookie, err := r.Cookie("visageUser")
    if err != nil {
      id, err := uuid.NewRandom()

      if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
      }

      userID = strings.ReplaceAll(id.String(), "-", "")

      cookie := http.Cookie{
        Name:     "visageUser",
        Value:    userID,
        Path:     "/",
        MaxAge:   60 * 60 * 24 * 90,
        HttpOnly: true,
      }

      http.SetCookie(w, &cookie)

    } else {
      userID = cookie.Value
    }
    ctx := context.WithValue(r.Context(), keyUserID, userID)
    next.ServeHTTP(w, r.WithContext(ctx))
  })
}

func main() {
  r := mux.NewRouter()
  s := r.PathPrefix("/api").Subrouter()
  s.HandleFunc("/room/join/{room}", joinRoom)
  s.HandleFunc("/room/create", createRoom)

  contextedMux := addContext(r)

  http.Handle("/", r)
  http.ListenAndServe(":8080", contextedMux)
}

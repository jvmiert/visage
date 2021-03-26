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

  rdb := connections.RClient()
  val, err := rdb.Get(ctx, room).Result()
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

  occupyCount, err := rdb.Incr(ctx, room).Result()

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
  clientID := r.Context().Value(keyUserID).(string)

  id, err := uuid.NewRandom()

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  roomID := strings.ReplaceAll(id.String(), "-", "")

  rdb := connections.RClient()

  // making sure the room is empty
  val, err := rdb.HIncrBy(ctx, roomID, "occupancyCount", 1).Result()

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  if val > 1 {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  /*
     @TODO:
       - Receive SDP offer made
       - Redirect to join room as host
   **/

  // setting the user uuid as host id of the newly created room
  rdb.HSet(ctx, roomID, "host", clientID)


  // creating a list to post to Redis for SFU
  keyValue := [2]string{clientID, roomID}

  js, err := json.Marshal(keyValue)
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  pubsub := rdb.Subscribe(ctx, roomID)

  fmt.Println("Subbing to: ", roomID)

  err = rdb.Publish(ctx, "sfu_info", js).Err()
  if err != nil {
      panic(err)
  }

awaitLoop:
  for {
      msg, err := pubsub.ReceiveMessage(ctx)
      if err != nil {
          panic(err)
      }
      switch msg.Payload {
      case "done":
        fmt.Println("Got 'done' message...")
        pubsub.Unsubscribe(ctx, roomID)
        fmt.Println("Unsubbed")
        break awaitLoop
      }
  }  

  js, err = json.Marshal(roomID)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
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

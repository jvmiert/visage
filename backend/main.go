package main

import (
  "context"
  "encoding/json"
  "fmt"
  "net/http"
  "strings"
  "time"
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

type answerPost struct {
  Answer string
  Room   string
}

// TODO: this needs to be shared between SFU and Backend.
// Might have to combine bot components into a single folder so we can export
// and import.
type SFURequest struct {
  Type     string
  ClientID string
  RoomID   string
  Payload  string
}

func joinRoom(w http.ResponseWriter, r *http.Request) {
  params := mux.Vars(r)
  room := params["room"]

  rdb := connections.RClient()
  val, err := rdb.HGetAll(ctx, room).Result()

  switch {
  case err == redis.Nil:
    http.Error(w, "room doesn't exist", http.StatusNotFound)
    return
  case err != nil:
    fmt.Println("Redis returned an error")
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  // occupyCount, err := rdb.Incr(ctx, room).Result()

  // if err != nil {
  //   http.Error(w, err.Error(), http.StatusInternalServerError)
  //   return
  // }

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

  // if occupyCount > 1 {
  //   m := replyMessage{true, false}
  //   js, err := json.Marshal(m)

  //   if err != nil {
  //     http.Error(w, err.Error(), http.StatusInternalServerError)
  //     return
  //   }

  //   w.Header().Set("Content-Type", "application/json")
  //   w.Write(js)
  //   return
  // }

  m := replyMessage{true, true}
  returnMap := map[string]interface{}{"roomInfo": m, "hostOffer": val["hostOffer"], "hostCandidate": val["hostOfferCandidates"]}

  js, err := json.Marshal(returnMap)

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

  rdb.Expire(ctx, roomID, 24*time.Hour)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  if val > 1 {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  // setting the user uuid as host id of the newly created room
  rdb.HSet(ctx, roomID, "host", clientID)

  request := SFURequest{
    Type:     "create",
    ClientID: clientID,
    RoomID:   roomID,
    Payload:  ""}

  js, err := json.Marshal(request)
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  // subscribe to be notified when offer and candidate are
  // put into Redis by SFU
  pubsub := rdb.Subscribe(ctx, roomID)

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
      pubsub.Unsubscribe(ctx, roomID)
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

func registerAnswer(w http.ResponseWriter, r *http.Request) {
  clientID := r.Context().Value(keyUserID).(string)
  decoder := json.NewDecoder(r.Body)
  var t answerPost
  err := decoder.Decode(&t)
  if err != nil {
    panic(err)
  }

  request := SFURequest{
    Type:     "answer",
    ClientID: clientID,
    RoomID:   t.Room,
    Payload:  t.Answer}

  js, err := json.Marshal(request)
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  rdb := connections.RClient()
  err = rdb.Publish(ctx, "sfu_info", js).Err()
  if err != nil {
    panic(err)
  }

  w.Write([]byte("Got it."))
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
  s.HandleFunc("/answer", registerAnswer).Methods("POST")

  contextedMux := addContext(r)

  http.Handle("/", r)
  http.ListenAndServe(":8080", contextedMux)
}

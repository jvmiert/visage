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

type key int

const (
  keyUserID key = iota
)

type offerPost struct {
  Offer string
  Room  string
}

type candidatePost struct {
  Candidate string
  Room      string
}

type peerInfo struct {
  IsPresent bool
  IsHost    bool
}

type SFURequest struct {
  Type     string
  ClientID string
  RoomID   string
  Payload  string
}
type backendReply struct {
  Type    string
  Payload string
}

func joinRoom(w http.ResponseWriter, r *http.Request) {
  clientID := r.Context().Value(keyUserID).(string)
  params := mux.Vars(r)
  roomID := params["room"]

  rdb := connections.RClient()
  occupants, err := rdb.HGet(ctx, roomID, "occupants").Result()

  switch {
  case err == redis.Nil:
    http.Error(w, "room doesn't exist", http.StatusNotFound)
    return
  case err != nil:
    fmt.Println("Redis returned an error")
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  occupantsInfo := map[string]*peerInfo{}
  err = json.Unmarshal([]byte(occupants), &occupantsInfo)

  if err != nil {
    fmt.Println("Couldn't decode message...")
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  if _, present := occupantsInfo[clientID]; !present {
    _, err := rdb.HIncrBy(ctx, roomID, "occupancyCount", 1).Result()

    if err != nil {
      http.Error(w, err.Error(), http.StatusInternalServerError)
      return
    }

    // we do not want to check if room is full yet
    // if val > 2 {
    //   http.Error(w, err.Error(), http.StatusInternalServerError)
    //   return
    // }
    rdb.Expire(ctx, roomID, 24*time.Hour)

    occupantsInfo[clientID] = &peerInfo{IsPresent: false, IsHost: false}
    roomJSON, err := json.Marshal(occupantsInfo)
    if err != nil {
      http.Error(w, err.Error(), http.StatusInternalServerError)
      return
    }
    rdb.HSet(ctx, roomID, "occupants", roomJSON)
  }

  returnMap := map[string]interface{}{
    "occupants": occupantsInfo,
    "isHost":    occupantsInfo[clientID].IsHost,
    "joinable":  true,
    "reconnect": occupantsInfo[clientID].IsPresent,
  }

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

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  if val > 1 {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }
  rdb.Expire(ctx, roomID, 24*time.Hour)

  occupantsInfo := map[string]*peerInfo{}
  occupantsInfo[clientID] = &peerInfo{IsPresent: false, IsHost: true}

  roomJSON, err := json.Marshal(occupantsInfo)
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  // setting the user uuid as host id of the newly created room
  rdb.HSet(ctx, roomID, "occupants", roomJSON)

  js, err := json.Marshal(roomID)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func registerOffer(w http.ResponseWriter, r *http.Request) {
  clientID := r.Context().Value(keyUserID).(string)
  decoder := json.NewDecoder(r.Body)
  var t offerPost
  err := decoder.Decode(&t)
  if err != nil {
    panic(err)
  }

  request := SFURequest{
    Type:     "offer",
    ClientID: clientID,
    RoomID:   t.Room,
    Payload:  t.Offer}

  js, err := json.Marshal(request)
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  rdb := connections.RClient()

  pubsub := rdb.Subscribe(ctx, clientID)

  err = rdb.Publish(ctx, "sfu_info", js).Err()
  if err != nil {
    panic(err)
  }

  var candidate string
  var answer string

awaitLoop:
  for {
    msg, err := pubsub.ReceiveMessage(ctx)
    if err != nil {
      panic(err)
    }
    var reply backendReply
    err = json.Unmarshal([]byte(msg.Payload), &reply)

    if err != nil {
      fmt.Println("Couldn't decode message...")
    }

    switch reply.Type {
    case "done":
      pubsub.Unsubscribe(ctx, clientID)
      break awaitLoop
    case "answer":
      answer = reply.Payload
    case "candidate":
      candidate = reply.Payload
    }
  }

  returnMap := map[string]interface{}{
    "answer":    answer,
    "candidate": candidate,
  }

  js, err = json.Marshal(returnMap)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func registerCandidate(w http.ResponseWriter, r *http.Request) {
  clientID := r.Context().Value(keyUserID).(string)
  decoder := json.NewDecoder(r.Body)
  var t candidatePost
  err := decoder.Decode(&t)
  if err != nil {
    panic(err)
  }

  request := SFURequest{
    Type:     "candidate",
    ClientID: clientID,
    RoomID:   t.Room,
    Payload:  t.Candidate}

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
  s.HandleFunc("/offer", registerOffer).Methods("POST")
  s.HandleFunc("/candidate", registerCandidate).Methods("POST")

  contextedMux := addContext(r)

  http.Handle("/", r)
  http.ListenAndServe(":8080", contextedMux)
}

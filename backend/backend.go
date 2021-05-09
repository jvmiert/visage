package main

import (
  "context"
  "encoding/json"
  "fmt"
  "net"
  "net/http"
  "os"
  "strings"
  "time"

  "github.com/go-redis/redis/v8"
  "github.com/google/uuid"
  "github.com/gorilla/mux"
)

var ctx = context.Background()

type key int

const (
  keyUserID key = iota
)

type peerInfo struct {
  IsPresent bool
  IsHost    bool
}

func RClient() *redis.Client {
  client := redis.NewClient(&redis.Options{
    Addr: "localhost:6379",
  })

  return client
}

func StartBackend(SFU *SFUServer) {
  logger.Info("Starting backend...")

  r := mux.NewRouter()
  r.HandleFunc("/ws", SFU.websocketHandler)
  s := r.PathPrefix("/api").Subrouter()
  s.HandleFunc("/room/join/{room}", joinRoom)
  s.HandleFunc("/room/create/{room}", createRoom)
  s.HandleFunc("/room/create", createRoom)

  contextedMux := addCookieContext(r)

  srv := &http.Server{
    Handler: contextedMux,
  }

  backendLis, err := net.Listen("tcp", ":8080")
  if err != nil {
    logger.Error(err, "cannot bind to backend endpoint (:8080)")
    os.Exit(1)
  }
  logger.Info("Backend Listening...")

  err = srv.Serve(backendLis)
  if err != nil {
    logger.Error(err, "Backend server stopped")
  }
}

func joinRoom(w http.ResponseWriter, r *http.Request) {
  clientID := r.Context().Value(keyUserID).(string)
  params := mux.Vars(r)
  roomID := params["room"]

  rdb := RClient()
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
    "wsToken":   clientID,
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

  params := mux.Vars(r)
  roomID := params["room"]

  if roomID == "" {
    id, err := uuid.NewRandom()

    if err != nil {
      http.Error(w, err.Error(), http.StatusInternalServerError)
      return
    }

    roomID = strings.ReplaceAll(id.String(), "-", "")
  }

  rdb := RClient()

  // making sure the room is empty
  val, err := rdb.HIncrBy(ctx, roomID, "occupancyCount", 1).Result()

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  if val > 1 {
    http.Error(w, "full", http.StatusBadRequest)
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

func addCookieContext(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    var userID string
    cookie, err := r.Cookie("visageUser")
    if err != nil {
      userID := NewUid()

      cookie := http.Cookie{
        Name:     "visageUser",
        Value:    userID,
        Path:     "/",
        MaxAge:   60 * 60 * 24 * 90,
        HttpOnly: true,
        Secure:   false,
      }

      http.SetCookie(w, &cookie)

    } else {
      userID = cookie.Value
    }
    ctx := context.WithValue(r.Context(), keyUserID, userID)
    next.ServeHTTP(w, r.WithContext(ctx))
  })
}

package main

import (
  "context"
  "net"
  "net/http"
  "os"
  "time"

  "github.com/go-redis/redis/v8"
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
  s.HandleFunc("/room/join/{room}", joinRoom).Methods("GET")
  s.HandleFunc("/room/create/{room}", createRoom).Methods("POST")
  s.HandleFunc("/room/create", createRoom).Methods("POST")

  contextedMux := addCookieContext(r)

  srv := &http.Server{
    Handler:      contextedMux,
    WriteTimeout: 15 * time.Second,
    ReadTimeout:  15 * time.Second,
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

func addCookieContext(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    var userID string
    cookie, err := r.Cookie("visageUser")
    if err != nil {
      userID = NewUid()

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

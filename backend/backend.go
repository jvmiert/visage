package main

import (
  "context"
  "fmt"
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
  keySFU    key = iota
)

func RClient() *redis.Client {
  client := redis.NewClient(&redis.Options{
    Addr: "localhost:6379",
  })

  return client
}

func StartBackend(SFU *SFUServer, backendPort int) {
  logger.Info("Starting backend...")

  r := mux.NewRouter()
  r.HandleFunc("/ws", websocketHandler)
  s := r.PathPrefix("/api").Subrouter()
  s.HandleFunc("/room/join/{room}", joinRoom).Methods("GET")
  s.HandleFunc("/room/create/{room}", createRoom).Methods("POST")
  s.HandleFunc("/room/create", createRoom).Methods("POST")
  s.HandleFunc("/token", getToken).Methods("GET")
  s.HandleFunc("/user-token", getUserToken).Methods("GET")
  s.HandleFunc("/locations", getLocations).Methods("GET")

  contextedMux := addContext(r, SFU)

  srv := &http.Server{
    Handler:      contextedMux,
    WriteTimeout: 15 * time.Second,
    ReadTimeout:  15 * time.Second,
  }

  backendLis, err := net.Listen("tcp", fmt.Sprintf(":%d", backendPort))
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

func addContext(next http.Handler, SFU *SFUServer) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    var userID string

    mobileHeader := r.Header.Get("Authorization")

    if mobileHeader == "" {
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
    } else {
      userID = mobileHeader
    }
    ctx := context.WithValue(r.Context(), keyUserID, userID)
    ctx = context.WithValue(ctx, keySFU, SFU)
    next.ServeHTTP(w, r.WithContext(ctx))
  })
}

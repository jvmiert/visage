package main

import (
  "encoding/json"
  "net/http"
  "strings"

  "github.com/google/uuid"
  "github.com/gorilla/mux"
)

func getLocations(w http.ResponseWriter, r *http.Request) {
  //TODO: retrieve from Redis

  locationList := make([]string, 2)

  locationList[0] = "wss://dev.vanmiert.eu/ws"
  locationList[1] = "wss://dev.vanmiert.eu/ws-slow"

  js, err := json.Marshal(locationList)
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func getToken(w http.ResponseWriter, r *http.Request) {
  userID := NewUid()

  js, err := json.Marshal(userID)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func getUserToken(w http.ResponseWriter, r *http.Request) {
  userID := r.Context().Value(keyUserID).(string)

  js, err := json.Marshal(userID)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func joinRoom(w http.ResponseWriter, r *http.Request) {
  userID := r.Context().Value(keyUserID).(string)
  params := mux.Vars(r)
  roomID := params["room"]

  user := getOrMakeUser(userID)

  room, err := getRoom(roomID)

  if err == ErrRoomNotFound {
    http.Error(w, "room doesn't exist", http.StatusNotFound)
    return
  }

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  token, err := room.AddUser(user)

  if err == ErrRoomFull {
    http.Error(w, "room is full", http.StatusUnprocessableEntity)
    return
  }

  if err == ErrUserInRoom {
    http.Error(w, "user already in room", http.StatusUnprocessableEntity)
    return
  }

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  js, err := json.Marshal(token)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func createRoom(w http.ResponseWriter, r *http.Request) {
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

  room, err := makeRoom(roomID, true)

  if err == ErrRoomExists {
    http.Error(w, "room already exists", http.StatusUnprocessableEntity)
    return
  }

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  js, err := json.Marshal(room)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

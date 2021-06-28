package main

import (
  "encoding/json"
  "net/http"
  "strings"

  "github.com/google/uuid"
  "github.com/gorilla/mux"
)

type JoinRequest struct {
  Session string
}

func createUser(w http.ResponseWriter, r *http.Request) {
  s := r.Context().Value(keySFU).(*SFUServer)

  u, err := SaveUserToDB(r, s.mongoDB)

  if err != nil {
    http.Error(w, err.Error(), http.StatusBadRequest)
    return
  }

  js, err := json.Marshal(u)
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func getLocations(w http.ResponseWriter, r *http.Request) {
  s := r.Context().Value(keySFU).(*SFUServer)
  locationList, err := GetNodeList(s)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

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

  sessionID := GenerateUserSession()

  response := map[string]interface{}{
    "userID":    userID,
    "sessionID": sessionID,
  }

  js, err := json.Marshal(response)

  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func joinRoom(w http.ResponseWriter, r *http.Request) {
  s := r.Context().Value(keySFU).(*SFUServer)

  params := mux.Vars(r)
  roomID := params["room"]

  var j JoinRequest

  err := json.NewDecoder(r.Body).Decode(&j)
  if err != nil {
    http.Error(w, err.Error(), http.StatusBadRequest)
    return
  }

  sessionID := j.Session

  token, err := AddUserToRoom(roomID, sessionID, s)

  if err == ErrRoomNotFound {
    http.Error(w, "room doesn't exist", http.StatusNotFound)
    return
  }

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
  s := r.Context().Value(keySFU).(*SFUServer)

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

  room, err := makeRoom(roomID, true, s.rClient)

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

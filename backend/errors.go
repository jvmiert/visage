package main

import "errors"

var (
  // Tried to get user but was not found in Redis
  ErrUserNotFound = errors.New("user not found")
  // Tried to make user but key already exists in Redis
  ErrUserExists = errors.New("user already exists")
  // A user can only be in a single room at a time
  ErrUserInRoom = errors.New("user already in room")

  // Room is full
  ErrRoomFull     = errors.New("room is full")
  ErrRoomNotFound = errors.New("room not found")
  ErrRoomExists   = errors.New("room already exists")

  ErrNoLinkedPeer = errors.New("no peer linked to user")

  ErrSessionNotFound   = errors.New("session not found")
  ErrSessionPeerNotSet = errors.New("session peer not set")

  ErrNotImplemented = errors.New("not yet implemented")
)

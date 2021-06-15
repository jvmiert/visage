package main

type User struct {
  Uid       string `json:"uid"`
  SessionID string `json:"sessionID,omitempty"`
  Region    string `json:"region"`
  NodeID    string `json:"nodeID"`
}

func NewUid() string {
  ret, _ := GenerateRandomString(128)

  return ret
}

func GenerateUserSession() string {
  ret, _ := GenerateRandomString(128)

  return ret
}

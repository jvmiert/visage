package main

func NewUid() string {
  ret, _ := GenerateRandomString(128)

  return ret
}

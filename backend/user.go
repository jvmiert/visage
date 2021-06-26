package main

import (
  "fmt"

  "github.com/go-playground/validator/v10"
)

type UserInfo struct {
  Uid       string `json:"uid"`
  SessionID string `json:"sessionID,omitempty"`
  Region    string `json:"region"`
  NodeID    string `json:"nodeID"`
}

type User struct {
  Id       string `json:"uid"`
  CreateAt int64  `json:"createAt"`
  Password string `json:"password" validate:"required,min=8"`
  Email    string `json:"email" validate:"required_without=Phone,omitempty,email"`
  Phone    string `json:"phone" validate:"required_without=Email"`
  FullName string `json:"fullName" validate:"required"`
}

func (u *User) Validate() error {
  validate := validator.New()

  err := validate.Struct(u)
  if err != nil {
    if _, ok := err.(*validator.InvalidValidationError); ok {
      fmt.Println(err)
      return err
    }

    return err
  }
  return nil
}

func NewUid() string {
  ret, _ := GenerateRandomString(128)

  return ret
}

func GenerateUserSession() string {
  ret, _ := GenerateRandomString(128)

  return ret
}

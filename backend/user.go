package main

import (
  "context"
  "encoding/json"
  "fmt"
  "net/http"

  "github.com/go-playground/validator/v10"
  "go.mongodb.org/mongo-driver/bson"
  "go.mongodb.org/mongo-driver/mongo"
  "golang.org/x/crypto/bcrypt"
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

func (u *User) HashPassword() error {
  hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), 13)

  u.Password = string(hash)

  if err != nil {
    return err
  }
  return nil
}

func SaveUserToDB(r *http.Request, mongoDB *mongo.Database) (*User, error) {
  u, err := GetUserFromRequest(r)

  if err != nil {
    return nil, err
  }

  if u.Phone != "" {
    _, err := FindUserByPhone(mongoDB, u.Phone)

    // user already exists
    if err != mongo.ErrNoDocuments {
      return nil, ErrUserExists
    }
  }

  if u.Email != "" {
    _, err := FindUserByEmail(mongoDB, u.Email)

    // user already exists
    if err != mongo.ErrNoDocuments {
      return nil, ErrUserExists
    }
  }

  err = u.HashPassword()
  if err != nil {
    return nil, err
  }

  collection := mongoDB.Collection("users")

  _, err = collection.InsertOne(context.TODO(), u)
  if err != nil {
    return nil, err
  }

  return u, nil

}

func FindUserByPhone(mongoDB *mongo.Database, phone string) (*User, error) {
  var u *User

  filter := bson.D{{"phone", phone}}

  collection := mongoDB.Collection("users")

  err := collection.FindOne(context.TODO(), filter).Decode(&u)
  if err != nil {
    return nil, err
  }

  return u, nil
}

func FindUserByEmail(mongoDB *mongo.Database, email string) (*User, error) {
  var u *User

  filter := bson.D{{"email", email}}

  collection := mongoDB.Collection("users")

  err := collection.FindOne(context.TODO(), filter).Decode(&u)
  if err != nil {
    return nil, err
  }

  return u, nil
}

func GetUserFromRequest(r *http.Request) (*User, error) {
  var u *User

  decoder := json.NewDecoder(r.Body)
  err := decoder.Decode(&u)
  if err != nil {
    return nil, err
  }

  err = u.Validate()
  if err != nil {
    return nil, err
  }

  return u, nil
}

func NewUid() string {
  ret, _ := GenerateRandomString(128)

  return ret
}

func GenerateUserSession() string {
  ret, _ := GenerateRandomString(128)

  return ret
}

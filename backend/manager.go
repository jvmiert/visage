package main

import (
  "context"
  "encoding/json"
  "fmt"

  "github.com/go-redis/redis/v8"
  "github.com/go-redsync/redsync/v4"
  "github.com/go-redsync/redsync/v4/redis/goredis/v8"
)

type NodeInfo struct {
  NodeID     string `json:"nodeID"`
  NodeURL    string `json:"nodeURL"`
  NodeRegion string `json:"nodeRegion"`
}

var (
  nodeList []NodeInfo
)

func GetNodeList(s *SFUServer) (*[]NodeInfo, error) {
  nodeListRedis, err := RClient.Get(ctx, s.nodeKey).Result()

  if err == redis.Nil {
    return &nodeList, nil
  }

  if err != nil {
    return nil, err
  }

  err = json.Unmarshal([]byte(nodeListRedis), &nodeList)
  if err != nil {
    return nil, err
  }

  return &nodeList, nil
}

func registerNode(s *SFUServer) error {
  pool := goredis.NewPool(RClient)
  rs := redsync.New(pool)

  mutex := rs.NewMutex(s.nodeKeyMutex)
  mutex_ctx := context.Background()

  if err := mutex.LockContext(mutex_ctx); err != nil {
    return err
  }

  defer mutex.UnlockContext(mutex_ctx)

  nodeListRedis, err := RClient.Get(mutex_ctx, s.nodeKey).Result()

  emptyKey := false

  if err == redis.Nil {
    emptyKey = true
  }

  if err != nil && err != redis.Nil {
    fmt.Println("Error while getting node list", err)
    return err
  }

  if !emptyKey {
    err = json.Unmarshal([]byte(nodeListRedis), &nodeList)
    if err != nil {
      return err
    }

    for _, node := range nodeList {
      if node.NodeID == s.nodeID {
        return nil
      }
    }
  }

  n := &NodeInfo{
    NodeID:     s.nodeID,
    NodeURL:    s.nodeURL,
    NodeRegion: s.nodeRegion,
  }

  nodeList = append(nodeList, *n)

  nMarsh, err := json.Marshal(nodeList)
  if err != nil {
    return err
  }

  err = RClient.Set(mutex_ctx, s.nodeKey, nMarsh, 0).Err()

  if err != nil {
    return err
  }

  return nil
}

func deregisterNode(s *SFUServer) error {
  pool := goredis.NewPool(RClient)
  rs := redsync.New(pool)

  mutex := rs.NewMutex(s.nodeKeyMutex)
  mutex_ctx := context.Background()

  if err := mutex.LockContext(mutex_ctx); err != nil {
    return err
  }

  nodeListRedis, err := RClient.Get(mutex_ctx, s.nodeKey).Result()

  if err != nil {
    return err
  }

  err = json.Unmarshal([]byte(nodeListRedis), &nodeList)
  if err != nil {
    return err
  }

  found := false
  var indexFound int

  for index, node := range nodeList {
    if node.NodeID == s.nodeID {
      found = true
      indexFound = index
      break
    }
  }

  if found {
    nodeList = append(nodeList[:indexFound], nodeList[indexFound+1:]...)
  } else {
    if _, err := mutex.UnlockContext(mutex_ctx); err != nil {
      return err
    }
    return nil
  }

  nMarsh, err := json.Marshal(nodeList)
  if err != nil {
    return err
  }

  err = RClient.Set(mutex_ctx, s.nodeKey, nMarsh, 0).Err()

  if err != nil {
    return err
  }

  if _, err := mutex.UnlockContext(mutex_ctx); err != nil {
    return err
  }

  return nil
}

package main


import (
	"context"
  "net/http"
  "encoding/json"
  "visage/backend/connections"
  "github.com/go-redis/redis/v8"
  "github.com/gorilla/mux"
)

var ctx = context.Background()

func joinChannel(w http.ResponseWriter, r *http.Request){
  params := mux.Vars(r)
  channel := params["channel"]

  client := connections.RClient()
	val, err := client.Get(ctx, channel).Result()
	switch {
	case err == redis.Nil:
    http.Error(w, "channel doesn't exist", http.StatusNotFound)
    return
	case err != nil:
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
	case val == "":
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	js, err := json.Marshal(val)

	if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }


  w.Header().Set("Content-Type", "application/json")
  w.Write(js)
}

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/api/join/{channel}", joinChannel)

	http.Handle("/", r)
  http.ListenAndServe(":8080", nil)
}
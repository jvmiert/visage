package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"visage/backend/connections"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

var ctx = context.Background()

type replyMessage struct {
	Joinable bool
}

func joinChannel(w http.ResponseWriter, r *http.Request) {
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

	occupyCount, err := client.Incr(ctx, channel).Result()

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if occupyCount > 2 {
		m := replyMessage{false}
		js, err := json.Marshal(m)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(js)
		return

	}

	m := replyMessage{true}
	js, err := json.Marshal(m)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(js)
}

func createChannel(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.NewRandom()

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	idStr := strings.ReplaceAll(id.String(), "-", "")

	client := connections.RClient()
	val, err := client.Incr(ctx, idStr).Result()

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if val > 2 {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	js, err := json.Marshal(idStr)

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
	r.HandleFunc("/api/create", createChannel)

	http.Handle("/", r)
	http.ListenAndServe(":8080", nil)
}

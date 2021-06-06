// Code generated by the FlatBuffers compiler. DO NOT EDIT.

package events

import "strconv"

type Payload byte

const (
	PayloadNONE           Payload = 0
	PayloadCandidateTable Payload = 1
	PayloadStringPayload  Payload = 2
	PayloadJoinPayload    Payload = 3
)

var EnumNamesPayload = map[Payload]string{
	PayloadNONE:           "NONE",
	PayloadCandidateTable: "CandidateTable",
	PayloadStringPayload:  "StringPayload",
	PayloadJoinPayload:    "JoinPayload",
}

var EnumValuesPayload = map[string]Payload{
	"NONE":           PayloadNONE,
	"CandidateTable": PayloadCandidateTable,
	"StringPayload":  PayloadStringPayload,
	"JoinPayload":    PayloadJoinPayload,
}

func (v Payload) String() string {
	if s, ok := EnumNamesPayload[v]; ok {
		return s
	}
	return "Payload(" + strconv.FormatInt(int64(v), 10) + ")"
}

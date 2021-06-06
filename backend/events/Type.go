// Code generated by the FlatBuffers compiler. DO NOT EDIT.

package events

import "strconv"

type Type int8

const (
	TypeOffer  Type = 0
	TypeAnswer Type = 1
	TypeSignal Type = 2
	TypeJoin   Type = 3
)

var EnumNamesType = map[Type]string{
	TypeOffer:  "Offer",
	TypeAnswer: "Answer",
	TypeSignal: "Signal",
	TypeJoin:   "Join",
}

var EnumValuesType = map[string]Type{
	"Offer":  TypeOffer,
	"Answer": TypeAnswer,
	"Signal": TypeSignal,
	"Join":   TypeJoin,
}

func (v Type) String() string {
	if s, ok := EnumNamesType[v]; ok {
		return s
	}
	return "Type(" + strconv.FormatInt(int64(v), 10) + ")"
}

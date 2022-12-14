// Code generated by the FlatBuffers compiler. DO NOT EDIT.

package events

import (
	flatbuffers "github.com/google/flatbuffers/go"
)

type StringPayload struct {
	_tab flatbuffers.Table
}

func GetRootAsStringPayload(buf []byte, offset flatbuffers.UOffsetT) *StringPayload {
	n := flatbuffers.GetUOffsetT(buf[offset:])
	x := &StringPayload{}
	x.Init(buf, n+offset)
	return x
}

func GetSizePrefixedRootAsStringPayload(buf []byte, offset flatbuffers.UOffsetT) *StringPayload {
	n := flatbuffers.GetUOffsetT(buf[offset+flatbuffers.SizeUint32:])
	x := &StringPayload{}
	x.Init(buf, n+offset+flatbuffers.SizeUint32)
	return x
}

func (rcv *StringPayload) Init(buf []byte, i flatbuffers.UOffsetT) {
	rcv._tab.Bytes = buf
	rcv._tab.Pos = i
}

func (rcv *StringPayload) Table() flatbuffers.Table {
	return rcv._tab
}

func (rcv *StringPayload) Payload() []byte {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(4))
	if o != 0 {
		return rcv._tab.ByteVector(o + rcv._tab.Pos)
	}
	return nil
}

func StringPayloadStart(builder *flatbuffers.Builder) {
	builder.StartObject(1)
}
func StringPayloadAddPayload(builder *flatbuffers.Builder, payload flatbuffers.UOffsetT) {
	builder.PrependUOffsetTSlot(0, flatbuffers.UOffsetT(payload), 0)
}
func StringPayloadEnd(builder *flatbuffers.Builder) flatbuffers.UOffsetT {
	return builder.EndObject()
}

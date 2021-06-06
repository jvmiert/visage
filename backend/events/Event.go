// Code generated by the FlatBuffers compiler. DO NOT EDIT.

package events

import (
	flatbuffers "github.com/google/flatbuffers/go"
)

type Event struct {
	_tab flatbuffers.Table
}

func GetRootAsEvent(buf []byte, offset flatbuffers.UOffsetT) *Event {
	n := flatbuffers.GetUOffsetT(buf[offset:])
	x := &Event{}
	x.Init(buf, n+offset)
	return x
}

func GetSizePrefixedRootAsEvent(buf []byte, offset flatbuffers.UOffsetT) *Event {
	n := flatbuffers.GetUOffsetT(buf[offset+flatbuffers.SizeUint32:])
	x := &Event{}
	x.Init(buf, n+offset+flatbuffers.SizeUint32)
	return x
}

func (rcv *Event) Init(buf []byte, i flatbuffers.UOffsetT) {
	rcv._tab.Bytes = buf
	rcv._tab.Pos = i
}

func (rcv *Event) Table() flatbuffers.Table {
	return rcv._tab
}

func (rcv *Event) Type() Type {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(4))
	if o != 0 {
		return Type(rcv._tab.GetInt8(o + rcv._tab.Pos))
	}
	return 0
}

func (rcv *Event) MutateType(n Type) bool {
	return rcv._tab.MutateInt8Slot(4, int8(n))
}

func (rcv *Event) Target() Target {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(6))
	if o != 0 {
		return Target(rcv._tab.GetInt8(o + rcv._tab.Pos))
	}
	return 0
}

func (rcv *Event) MutateTarget(n Target) bool {
	return rcv._tab.MutateInt8Slot(6, int8(n))
}

func (rcv *Event) PayloadType() Payload {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(8))
	if o != 0 {
		return Payload(rcv._tab.GetByte(o + rcv._tab.Pos))
	}
	return 0
}

func (rcv *Event) MutatePayloadType(n Payload) bool {
	return rcv._tab.MutateByteSlot(8, byte(n))
}

func (rcv *Event) Payload(obj *flatbuffers.Table) bool {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(10))
	if o != 0 {
		rcv._tab.Union(obj, o)
		return true
	}
	return false
}

func EventStart(builder *flatbuffers.Builder) {
	builder.StartObject(4)
}
func EventAddType(builder *flatbuffers.Builder, type_ Type) {
	builder.PrependInt8Slot(0, int8(type_), 0)
}
func EventAddTarget(builder *flatbuffers.Builder, target Target) {
	builder.PrependInt8Slot(1, int8(target), 0)
}
func EventAddPayloadType(builder *flatbuffers.Builder, payloadType Payload) {
	builder.PrependByteSlot(2, byte(payloadType), 0)
}
func EventAddPayload(builder *flatbuffers.Builder, payload flatbuffers.UOffsetT) {
	builder.PrependUOffsetTSlot(3, flatbuffers.UOffsetT(payload), 0)
}
func EventEnd(builder *flatbuffers.Builder) flatbuffers.UOffsetT {
	return builder.EndObject()
}

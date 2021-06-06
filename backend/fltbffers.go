package main

import (
  "visage/pion/events"

  flatbuffers "github.com/google/flatbuffers/go"
  "github.com/pion/webrtc/v3"
)

// TODO: Replace this function with serializeAnswer and serializeOffer
func createMessage(eventType events.Type, user []byte, room []byte, payloadString []byte, payloadCandidate *webrtc.ICECandidateInit, target events.Target) []byte {
  builder := flatbuffers.NewBuilder(0)

  var newPayload flatbuffers.UOffsetT
  var newPayloadType events.Payload

  if payloadCandidate != nil {
    candiS := builder.CreateByteString([]byte(payloadCandidate.Candidate))
    sdpS := builder.CreateByteString([]byte(*payloadCandidate.SDPMid))

    var unameS flatbuffers.UOffsetT
    if payloadCandidate.UsernameFragment != nil {
      unameS = builder.CreateByteString([]byte(*payloadCandidate.UsernameFragment))
    } else {
      unameS = builder.CreateByteString([]byte(""))
    }

    events.CandidateTableStart(builder)

    events.CandidateTableAddCandidate(builder, candiS)
    events.CandidateTableAddSdpMid(builder, sdpS)
    events.CandidateTableAddSdpmLineIndex(builder, *payloadCandidate.SDPMLineIndex)
    events.CandidateTableAddUsernameFragment(builder, unameS)

    newPayload = events.CandidateTableEnd(builder)
    newPayloadType = events.PayloadCandidateTable
  }

  if payloadString != nil {
    payloadS := builder.CreateByteString(payloadString)

    events.StringPayloadStart(builder)
    events.StringPayloadAddPayload(builder, payloadS)
    newPayload = events.StringPayloadEnd(builder)
    newPayloadType = events.PayloadStringPayload
  }

  events.EventStart(builder)

  events.EventAddPayloadType(builder, newPayloadType)
  events.EventAddPayload(builder, newPayload)

  events.EventAddType(builder, eventType)
  events.EventAddTarget(builder, target)

  newEvent := events.EventEnd(builder)

  builder.Finish(newEvent)

  return builder.FinishedBytes()

}

func serializeICE(payloadCandidate *webrtc.ICECandidateInit, target events.Target) []byte {
  builder := flatbuffers.NewBuilder(0)

  candiS := builder.CreateByteString([]byte(payloadCandidate.Candidate))
  sdpS := builder.CreateByteString([]byte(*payloadCandidate.SDPMid))

  var unameS flatbuffers.UOffsetT
  if payloadCandidate.UsernameFragment != nil {
    unameS = builder.CreateByteString([]byte(*payloadCandidate.UsernameFragment))
  } else {
    unameS = builder.CreateByteString([]byte(""))
  }

  events.CandidateTableStart(builder)

  events.CandidateTableAddCandidate(builder, candiS)
  events.CandidateTableAddSdpMid(builder, sdpS)
  events.CandidateTableAddSdpmLineIndex(builder, *payloadCandidate.SDPMLineIndex)
  events.CandidateTableAddUsernameFragment(builder, unameS)

  newPayload := events.CandidateTableEnd(builder)
  newPayloadType := events.PayloadCandidateTable

  events.EventStart(builder)

  events.EventAddPayloadType(builder, newPayloadType)
  events.EventAddPayload(builder, newPayload)
  events.EventAddType(builder, events.TypeSignal)
  events.EventAddTarget(builder, target)

  newEvent := events.EventEnd(builder)

  builder.Finish(newEvent)

  return builder.FinishedBytes()
}

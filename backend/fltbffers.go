package main

import (
  "visage/pion/events"

  flatbuffers "github.com/google/flatbuffers/go"
  "github.com/pion/webrtc/v3"
)

func serializeSDP(eventType events.Type, SDPString []byte, target events.Target, replyId ...[]byte) []byte {
  var uuidReply []byte
  if len(replyId) > 0 {
    uuidReply = replyId[0]
  }

  builder := flatbuffers.NewBuilder(0)

  payloadOffset := builder.CreateByteString(SDPString)

  var uuidOffset flatbuffers.UOffsetT
  if len(replyId) > 0 {
    uuidOffset = builder.CreateByteString(uuidReply)
  }

  events.StringPayloadStart(builder)
  events.StringPayloadAddPayload(builder, payloadOffset)
  SDPPayload := events.StringPayloadEnd(builder)
  newPayloadType := events.PayloadStringPayload

  events.EventStart(builder)

  events.EventAddPayloadType(builder, newPayloadType)
  events.EventAddPayload(builder, SDPPayload)

  if len(replyId) > 0 {
    events.EventAddId(builder, uuidOffset)
  }

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

  events.CandidateTableStart(builder)

  events.CandidateTableAddCandidate(builder, candiS)
  events.CandidateTableAddSdpMid(builder, sdpS)
  events.CandidateTableAddSdpmLineIndex(builder, *payloadCandidate.SDPMLineIndex)

  if payloadCandidate.UsernameFragment != nil {
    var unameS flatbuffers.UOffsetT
    unameS = builder.CreateByteString([]byte(*payloadCandidate.UsernameFragment))
    events.CandidateTableAddUsernameFragment(builder, unameS)
  }

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

import { flatbuffers } from "flatbuffers";

import { JoinPayload } from "./join-payload";
import { StringPayload } from "./string-payload";
import { CandidateTable } from "./candidate-table";
import { Type } from "./type";
import { Target } from "./target";
import { Payload } from "./payload";
import { Event } from "./event";
import { LatencyPayload } from "./latency-payload";

export const serializeAnswer = (answer) => {
  let builder = new flatbuffers.Builder(0);

  const payloadOffset = builder.createString(answer.sdp);

  const offsetPayload = StringPayload.createStringPayload(
    builder,
    payloadOffset
  );

  Event.startEvent(builder);

  Event.addType(builder, Type.Answer);
  Event.addTarget(builder, Target.Subscriber);

  Event.addPayloadType(builder, Payload.StringPayload);
  Event.addPayload(builder, offsetPayload);

  let offset = Event.endEvent(builder);
  builder.finish(offset);

  const bytes = builder.asUint8Array();

  return bytes;
};

export const serializeLatency = (timestamp, id) => {
  let builder = new flatbuffers.Builder(0);

  const offsetPayload = LatencyPayload.createLatencyPayload(
    builder,
    timestamp,
    id
  );

  Event.startEvent(builder);

  Event.addType(builder, Type.Latency);

  Event.addPayloadType(builder, Payload.LatencyPayload);
  Event.addPayload(builder, offsetPayload);

  let offset = Event.endEvent(builder);
  builder.finish(offset);

  const bytes = builder.asUint8Array();

  return bytes;
};

export const serializeJoin = (offer, token) => {
  let builder = new flatbuffers.Builder(0);

  const offerOffset = builder.createString(offer);
  const tokenOffset = builder.createString(token);

  const offsetPayload = JoinPayload.createJoinPayload(
    builder,
    offerOffset,
    tokenOffset
  );

  Event.startEvent(builder);

  Event.addType(builder, Type.Join);
  Event.addTarget(builder, Target.Publisher);

  Event.addPayloadType(builder, Payload.JoinPayload);
  Event.addPayload(builder, offsetPayload);

  let offset = Event.endEvent(builder);
  builder.finish(offset);

  const bytes = builder.asUint8Array();

  return bytes;
};

export const serializeTrickle = (candidate, target) => {
  let builder = new flatbuffers.Builder(0);

  const candidateOffset = builder.createString(candidate.candidate);
  const sdpMidOffset = builder.createString(candidate.sdpMid);
  const usernameFragmentOffset = builder.createString(
    candidate.usernameFragment
  );

  const offsetPayload = CandidateTable.createCandidateTable(
    builder,
    candidateOffset,
    sdpMidOffset,
    candidate.addSdpmLineIndex,
    usernameFragmentOffset
  );

  Event.startEvent(builder);

  Event.addType(builder, Type.Signal);
  Event.addTarget(builder, target);

  Event.addPayloadType(builder, Payload.CandidateTable);
  Event.addPayload(builder, offsetPayload);

  let offset = Event.endEvent(builder);
  builder.finish(offset);

  const bytes = builder.asUint8Array();

  return bytes;
};

export const getEventRoot = (data) => {
  const bytes = new Uint8Array(data);
  const buffer = new flatbuffers.ByteBuffer(bytes);
  const event = Event.getRootAsEvent(buffer);
  return event;
};

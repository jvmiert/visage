import { flatbuffers } from "flatbuffers";
import { events } from "./event_generated.js";

export const createMessage = (
  eventType,
  user,
  room,
  payloadString,
  payloadCandidate,
  target
) => {
  let offsetPayload;
  let Event = events.Event;
  let payloadType;
  let builder = new flatbuffers.Builder(0);

  if (payloadCandidate) {
    payloadType = events.Payload.CandidateTable;

    const candidateS = builder.createString(payloadCandidate.candidate);
    const sdpMidS = builder.createString(payloadCandidate.sdpMid);
    const usernameFragmentS = builder.createString(
      payloadCandidate.usernameFragment
    );

    let CandidateTable = events.CandidateTable;

    CandidateTable.startCandidateTable(builder);
    CandidateTable.addCandidate(builder, candidateS);
    CandidateTable.addSdpMid(builder, sdpMidS);
    CandidateTable.addSdpmLineIndex(builder, payloadCandidate.addSdpmLineIndex);
    CandidateTable.addUsernameFragment(builder, usernameFragmentS);

    offsetPayload = CandidateTable.endCandidateTable(builder);
  }

  if (payloadString) {
    payloadType = events.Payload.StringPayload;
    const payloadS = builder.createString(payloadString);

    let StringPayload = events.StringPayload;

    StringPayload.startStringPayload(builder);
    StringPayload.addPayload(builder, payloadS);

    offsetPayload = StringPayload.endStringPayload(builder);
  }

  var userID = builder.createString(user);
  var roomID = builder.createString(room);

  Event.startEvent(builder);

  Event.addType(builder, eventType);
  Event.addTarget(builder, target);

  Event.addPayloadType(builder, payloadType);
  Event.addPayload(builder, offsetPayload);

  Event.addUid(builder, userID);
  Event.addRoom(builder, roomID);

  let offset = Event.endEvent(builder);
  builder.finish(offset);

  const bytes = builder.asUint8Array();

  return bytes;
};

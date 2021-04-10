/* eslint-disable */
// automatically generated by the FlatBuffers compiler, do not modify

/**
 * @const
 * @namespace
 */
var events = events || {};

/**
 * @enum {number}
 */
events.Target = {
  Subscriber: 0,
  Publisher: 1,
};

/**
 * @enum {string}
 */
events.TargetName = {
  0: "Subscriber",
  1: "Publisher",
};

/**
 * @enum {number}
 */
events.Type = {
  Offer: 0,
  Answer: 1,
  Signal: 2,
  Join: 3,
};

/**
 * @enum {string}
 */
events.TypeName = {
  0: "Offer",
  1: "Answer",
  2: "Signal",
  3: "Join",
};

/**
 * @enum {number}
 */
events.Payload = {
  NONE: 0,
  CandidateTable: 1,
  StringPayload: 2,
};

/**
 * @enum {string}
 */
events.PayloadName = {
  0: "NONE",
  1: "CandidateTable",
  2: "StringPayload",
};

/**
 * @constructor
 */
events.CandidateTable = function () {
  /**
   * @type {flatbuffers.ByteBuffer}
   */
  this.bb = null;

  /**
   * @type {number}
   */
  this.bb_pos = 0;
};

/**
 * @param {number} i
 * @param {flatbuffers.ByteBuffer} bb
 * @returns {events.CandidateTable}
 */
events.CandidateTable.prototype.__init = function (i, bb) {
  this.bb_pos = i;
  this.bb = bb;
  return this;
};

/**
 * @param {flatbuffers.ByteBuffer} bb
 * @param {events.CandidateTable=} obj
 * @returns {events.CandidateTable}
 */
events.CandidateTable.getRootAsCandidateTable = function (bb, obj) {
  return (obj || new events.CandidateTable()).__init(
    bb.readInt32(bb.position()) + bb.position(),
    bb
  );
};

/**
 * @param {flatbuffers.Encoding=} optionalEncoding
 * @returns {string|Uint8Array|null}
 */
events.CandidateTable.prototype.candidate = function (optionalEncoding) {
  var offset = this.bb.__offset(this.bb_pos, 4);
  return offset
    ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
    : null;
};

/**
 * @param {flatbuffers.Encoding=} optionalEncoding
 * @returns {string|Uint8Array|null}
 */
events.CandidateTable.prototype.sdpMid = function (optionalEncoding) {
  var offset = this.bb.__offset(this.bb_pos, 6);
  return offset
    ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
    : null;
};

/**
 * @returns {number}
 */
events.CandidateTable.prototype.sdpmLineIndex = function () {
  var offset = this.bb.__offset(this.bb_pos, 8);
  return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
};

/**
 * @param {flatbuffers.Encoding=} optionalEncoding
 * @returns {string|Uint8Array|null}
 */
events.CandidateTable.prototype.usernameFragment = function (optionalEncoding) {
  var offset = this.bb.__offset(this.bb_pos, 10);
  return offset
    ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
    : null;
};

/**
 * @param {flatbuffers.Builder} builder
 */
events.CandidateTable.startCandidateTable = function (builder) {
  builder.startObject(4);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} candidateOffset
 */
events.CandidateTable.addCandidate = function (builder, candidateOffset) {
  builder.addFieldOffset(0, candidateOffset, 0);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} sdpMidOffset
 */
events.CandidateTable.addSdpMid = function (builder, sdpMidOffset) {
  builder.addFieldOffset(1, sdpMidOffset, 0);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {number} sdpmLineIndex
 */
events.CandidateTable.addSdpmLineIndex = function (builder, sdpmLineIndex) {
  builder.addFieldInt16(2, sdpmLineIndex, 0);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} usernameFragmentOffset
 */
events.CandidateTable.addUsernameFragment = function (
  builder,
  usernameFragmentOffset
) {
  builder.addFieldOffset(3, usernameFragmentOffset, 0);
};

/**
 * @param {flatbuffers.Builder} builder
 * @returns {flatbuffers.Offset}
 */
events.CandidateTable.endCandidateTable = function (builder) {
  var offset = builder.endObject();
  return offset;
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} candidateOffset
 * @param {flatbuffers.Offset} sdpMidOffset
 * @param {number} sdpmLineIndex
 * @param {flatbuffers.Offset} usernameFragmentOffset
 * @returns {flatbuffers.Offset}
 */
events.CandidateTable.createCandidateTable = function (
  builder,
  candidateOffset,
  sdpMidOffset,
  sdpmLineIndex,
  usernameFragmentOffset
) {
  events.CandidateTable.startCandidateTable(builder);
  events.CandidateTable.addCandidate(builder, candidateOffset);
  events.CandidateTable.addSdpMid(builder, sdpMidOffset);
  events.CandidateTable.addSdpmLineIndex(builder, sdpmLineIndex);
  events.CandidateTable.addUsernameFragment(builder, usernameFragmentOffset);
  return events.CandidateTable.endCandidateTable(builder);
};

/**
 * @constructor
 */
events.StringPayload = function () {
  /**
   * @type {flatbuffers.ByteBuffer}
   */
  this.bb = null;

  /**
   * @type {number}
   */
  this.bb_pos = 0;
};

/**
 * @param {number} i
 * @param {flatbuffers.ByteBuffer} bb
 * @returns {events.StringPayload}
 */
events.StringPayload.prototype.__init = function (i, bb) {
  this.bb_pos = i;
  this.bb = bb;
  return this;
};

/**
 * @param {flatbuffers.ByteBuffer} bb
 * @param {events.StringPayload=} obj
 * @returns {events.StringPayload}
 */
events.StringPayload.getRootAsStringPayload = function (bb, obj) {
  return (obj || new events.StringPayload()).__init(
    bb.readInt32(bb.position()) + bb.position(),
    bb
  );
};

/**
 * @param {flatbuffers.Encoding=} optionalEncoding
 * @returns {string|Uint8Array|null}
 */
events.StringPayload.prototype.payload = function (optionalEncoding) {
  var offset = this.bb.__offset(this.bb_pos, 4);
  return offset
    ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
    : null;
};

/**
 * @param {flatbuffers.Builder} builder
 */
events.StringPayload.startStringPayload = function (builder) {
  builder.startObject(1);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} payloadOffset
 */
events.StringPayload.addPayload = function (builder, payloadOffset) {
  builder.addFieldOffset(0, payloadOffset, 0);
};

/**
 * @param {flatbuffers.Builder} builder
 * @returns {flatbuffers.Offset}
 */
events.StringPayload.endStringPayload = function (builder) {
  var offset = builder.endObject();
  return offset;
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} payloadOffset
 * @returns {flatbuffers.Offset}
 */
events.StringPayload.createStringPayload = function (builder, payloadOffset) {
  events.StringPayload.startStringPayload(builder);
  events.StringPayload.addPayload(builder, payloadOffset);
  return events.StringPayload.endStringPayload(builder);
};

/**
 * @constructor
 */
events.Event = function () {
  /**
   * @type {flatbuffers.ByteBuffer}
   */
  this.bb = null;

  /**
   * @type {number}
   */
  this.bb_pos = 0;
};

/**
 * @param {number} i
 * @param {flatbuffers.ByteBuffer} bb
 * @returns {events.Event}
 */
events.Event.prototype.__init = function (i, bb) {
  this.bb_pos = i;
  this.bb = bb;
  return this;
};

/**
 * @param {flatbuffers.ByteBuffer} bb
 * @param {events.Event=} obj
 * @returns {events.Event}
 */
events.Event.getRootAsEvent = function (bb, obj) {
  return (obj || new events.Event()).__init(
    bb.readInt32(bb.position()) + bb.position(),
    bb
  );
};

/**
 * @returns {events.Type}
 */
events.Event.prototype.type = function () {
  var offset = this.bb.__offset(this.bb_pos, 4);
  return offset
    ? /** @type {events.Type} */ (this.bb.readInt8(this.bb_pos + offset))
    : events.Type.Offer;
};

/**
 * @returns {events.Target}
 */
events.Event.prototype.target = function () {
  var offset = this.bb.__offset(this.bb_pos, 6);
  return offset
    ? /** @type {events.Target} */ (this.bb.readInt8(this.bb_pos + offset))
    : events.Target.Subscriber;
};

/**
 * @returns {events.Payload}
 */
events.Event.prototype.payloadType = function () {
  var offset = this.bb.__offset(this.bb_pos, 8);
  return offset
    ? /** @type {events.Payload} */ (this.bb.readUint8(this.bb_pos + offset))
    : events.Payload.NONE;
};

/**
 * @param {flatbuffers.Table} obj
 * @returns {?flatbuffers.Table}
 */
events.Event.prototype.payload = function (obj) {
  var offset = this.bb.__offset(this.bb_pos, 10);
  return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
};

/**
 * @param {flatbuffers.Encoding=} optionalEncoding
 * @returns {string|Uint8Array|null}
 */
events.Event.prototype.uid = function (optionalEncoding) {
  var offset = this.bb.__offset(this.bb_pos, 12);
  return offset
    ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
    : null;
};

/**
 * @param {flatbuffers.Encoding=} optionalEncoding
 * @returns {string|Uint8Array|null}
 */
events.Event.prototype.room = function (optionalEncoding) {
  var offset = this.bb.__offset(this.bb_pos, 14);
  return offset
    ? this.bb.__string(this.bb_pos + offset, optionalEncoding)
    : null;
};

/**
 * @param {flatbuffers.Builder} builder
 */
events.Event.startEvent = function (builder) {
  builder.startObject(6);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {events.Type} type
 */
events.Event.addType = function (builder, type) {
  builder.addFieldInt8(0, type, events.Type.Offer);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {events.Target} target
 */
events.Event.addTarget = function (builder, target) {
  builder.addFieldInt8(1, target, events.Target.Subscriber);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {events.Payload} payloadType
 */
events.Event.addPayloadType = function (builder, payloadType) {
  builder.addFieldInt8(2, payloadType, events.Payload.NONE);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} payloadOffset
 */
events.Event.addPayload = function (builder, payloadOffset) {
  builder.addFieldOffset(3, payloadOffset, 0);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} uidOffset
 */
events.Event.addUid = function (builder, uidOffset) {
  builder.addFieldOffset(4, uidOffset, 0);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} roomOffset
 */
events.Event.addRoom = function (builder, roomOffset) {
  builder.addFieldOffset(5, roomOffset, 0);
};

/**
 * @param {flatbuffers.Builder} builder
 * @returns {flatbuffers.Offset}
 */
events.Event.endEvent = function (builder) {
  var offset = builder.endObject();
  return offset;
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {flatbuffers.Offset} offset
 */
events.Event.finishEventBuffer = function (builder, offset) {
  builder.finish(offset);
};

/**
 * @param {flatbuffers.Builder} builder
 * @param {events.Type} type
 * @param {events.Target} target
 * @param {events.Payload} payloadType
 * @param {flatbuffers.Offset} payloadOffset
 * @param {flatbuffers.Offset} uidOffset
 * @param {flatbuffers.Offset} roomOffset
 * @returns {flatbuffers.Offset}
 */
events.Event.createEvent = function (
  builder,
  type,
  target,
  payloadType,
  payloadOffset,
  uidOffset,
  roomOffset
) {
  events.Event.startEvent(builder);
  events.Event.addType(builder, type);
  events.Event.addTarget(builder, target);
  events.Event.addPayloadType(builder, payloadType);
  events.Event.addPayload(builder, payloadOffset);
  events.Event.addUid(builder, uidOffset);
  events.Event.addRoom(builder, roomOffset);
  return events.Event.endEvent(builder);
};

// Exports for Node.js and RequireJS
this.events = events;

"use strict";
// automatically generated by the FlatBuffers compiler, do not modify
exports.__esModule = true;
exports.Event = void 0;
var flatbuffers = require("flatbuffers");
var payload_1 = require("./payload");
var target_1 = require("./target");
var type_1 = require("./type");
var Event = /** @class */ (function () {
    function Event() {
        this.bb = null;
        this.bb_pos = 0;
    }
    Event.prototype.__init = function (i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    };
    Event.getRootAsEvent = function (bb, obj) {
        return (obj || new Event()).__init(
            bb.readInt32(bb.position()) + bb.position(),
            bb
        );
    };
    Event.getSizePrefixedRootAsEvent = function (bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new Event()).__init(
            bb.readInt32(bb.position()) + bb.position(),
            bb
        );
    };
    Event.prototype.type = function () {
        var offset = this.bb.__offset(this.bb_pos, 4);
        return offset
            ? this.bb.readInt8(this.bb_pos + offset)
            : type_1.Type.Offer;
    };
    Event.prototype.target = function () {
        var offset = this.bb.__offset(this.bb_pos, 6);
        return offset
            ? this.bb.readInt8(this.bb_pos + offset)
            : target_1.Target.Publisher;
    };
    Event.prototype.payloadType = function () {
        var offset = this.bb.__offset(this.bb_pos, 8);
        return offset
            ? this.bb.readUint8(this.bb_pos + offset)
            : payload_1.Payload.NONE;
    };
    Event.prototype.payload = function (obj) {
        var offset = this.bb.__offset(this.bb_pos, 10);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    };
    Event.startEvent = function (builder) {
        builder.startObject(4);
    };
    Event.addType = function (builder, type) {
        builder.addFieldInt8(0, type, type_1.Type.Offer);
    };
    Event.addTarget = function (builder, target) {
        builder.addFieldInt8(1, target, target_1.Target.Publisher);
    };
    Event.addPayloadType = function (builder, payloadType) {
        builder.addFieldInt8(2, payloadType, payload_1.Payload.NONE);
    };
    Event.addPayload = function (builder, payloadOffset) {
        builder.addFieldOffset(3, payloadOffset, 0);
    };
    Event.endEvent = function (builder) {
        var offset = builder.endObject();
        return offset;
    };
    Event.finishEventBuffer = function (builder, offset) {
        builder.finish(offset);
    };
    Event.finishSizePrefixedEventBuffer = function (builder, offset) {
        builder.finish(offset, undefined, true);
    };
    Event.createEvent = function (
        builder,
        type,
        target,
        payloadType,
        payloadOffset
    ) {
        Event.startEvent(builder);
        Event.addType(builder, type);
        Event.addTarget(builder, target);
        Event.addPayloadType(builder, payloadType);
        Event.addPayload(builder, payloadOffset);
        return Event.endEvent(builder);
    };
    return Event;
})();
exports.Event = Event;

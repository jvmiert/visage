"use strict";
// automatically generated by the FlatBuffers compiler, do not modify
exports.__esModule = true;
exports.StringPayload = void 0;
var flatbuffers = require("flatbuffers");
var StringPayload = /** @class */ (function () {
    function StringPayload() {
        this.bb = null;
        this.bb_pos = 0;
    }
    StringPayload.prototype.__init = function (i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    };
    StringPayload.getRootAsStringPayload = function (bb, obj) {
        return (obj || new StringPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    };
    StringPayload.getSizePrefixedRootAsStringPayload = function (bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new StringPayload()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    };
    StringPayload.prototype.payload = function (optionalEncoding) {
        var offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    };
    StringPayload.startStringPayload = function (builder) {
        builder.startObject(1);
    };
    StringPayload.addPayload = function (builder, payloadOffset) {
        builder.addFieldOffset(0, payloadOffset, 0);
    };
    StringPayload.endStringPayload = function (builder) {
        var offset = builder.endObject();
        return offset;
    };
    StringPayload.createStringPayload = function (builder, payloadOffset) {
        StringPayload.startStringPayload(builder);
        StringPayload.addPayload(builder, payloadOffset);
        return StringPayload.endStringPayload(builder);
    };
    return StringPayload;
}());
exports.StringPayload = StringPayload;

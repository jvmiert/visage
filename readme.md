## Goal

I want to establish a WebRTC connection between a peer and server. The peer then sends their video to the server.
Server takes this video and distributes it to other eligible peers.

## Learnings

- TURN is used to establish a connection between 2 parties by figuring out what public facing IP to use.
- ICE is a protocol that enables 2 parties to message with each other
- We should use the ICE password ("ice-pwd") as a way to authenticate joining a meeting (call join backend -> return ice-pwd -> establish ICE)

# How webrtc works

1. First we create a connection by signalling, during signalling we exchange SDP (Session Description Protocol) between clients
2. After being in possession of SDP, we attempt to connect. To achieve this, ICE (Interactive Connectivity Establishment) is used
3. After a connection is established through ICE, security is setup
4. Having completed above steps, we can exchange media over SRTP (Secure Real-time Transport Protocol and data over SCTP (Stream Control Transmission Protocol)

I believe what I'm looking for is a SFU.

- We need a SFU (selective fowarding unit) that broadcasts video to correct peers

## URLs

- https://github.com/pion/webrtc/issues/835
- https://github.com/pion/example-webrtc-applications/blob/master/sfu-ws/main.go
- https://github.com/pion/example-webrtc-applications/tree/master/sfu-ws
- https://webrtcforthecurious.com
- https://webrtc.github.io/samples/
- https://github.com/pion/webrtc
- https://github.com/pion/ion

## Random thoughts

- Marketing: people can join meetings but only exclusive group can make them
- Emoji URLs?
- SFU IETF informational document: https://tools.ietf.org/html/rfc7667#section-3.7
- Some other SFU: https://news.ycombinator.com/item?id=23523305

## Architecture

- The services has different spaces called rooms
- Every room has a single host and an x(= limited to 1 for now) number of participants
- Every host and participate shares audio/video with each other inside a room
- Rooms do not communicate with each other

## External docs
- Marketing thoughts: https://docs.google.com/document/d/14VVOO5hUJ4pbQnMckhnQb6p-LY6x6ArrxO33nrFlUKk/edit#

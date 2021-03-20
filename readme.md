## Goal

I want to establish a WebRTC connection between a peer and server. The peer then sends their video to the server.
Server takes this video and distributes it to other eligible peers.

## Learnings

- TURN is used to establish a connection between 2 parties by figuring out what public facing IP to use.
- ICE is a protocol that enables 2 parties to message with each other

I believe what I'm looking for is a SFU.

- We need a SFU (selective fowarding unit) that broadcasts video to correct peers

## urls

- https://github.com/pion/example-webrtc-applications/blob/master/sfu-ws/main.go
- https://github.com/pion/example-webrtc-applications/tree/master/sfu-ws
- https://webrtcforthecurious.com
- https://webrtc.github.io/samples/
- https://github.com/pion/webrtc
- https://github.com/pion/ion

## random thoughts

- Marketing: people can join meetings but only exclusive group can make them
- Emoji URLs?

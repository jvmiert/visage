## Goal
I want to establish a WebRTC connection between a peer and server. The peer then sends their video to the server. 
Server takes this video and distributes it to other eligible peers.

## Learnings

- TURN is used to establish a connection between 2 parties by figuring out what public facing IP to use.
- ICE is a protocol that enables 2 parties to message with each other



I believe what I'm looking for is a SFU.

- We need a SFU (selective fowarding unit) that broadcasts video to correct peers

## urls
- https://github.com/pion/webrtc/issues/835
- https://github.com/pion/example-webrtc-applications/blob/master/sfu-ws/main.go
- https://github.com/pion/example-webrtc-applications/tree/master/sfu-ws
- https://webrtcforthecurious.com
- https://webrtc.github.io/samples/
- https://github.com/pion/webrtc
- https://github.com/pion/ion
- SFU IETF informational document: https://tools.ietf.org/html/rfc7667#section-3.7
- Some other SFU: https://news.ycombinator.com/item?id=23523305
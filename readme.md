## Goal

I want to establish a WebRTC connection between a peer and server. The peer then sends their video to the server.
Server takes this video and distributes it to other eligible peers.

## Approach

Pion server creates a PeerConnection and creates and offer for this peer. This PeerConnection needs to be retrievable by a session identification so its state can be updated. Idealy, all the ICE candidates for the server-side can be generated together with the offer and shared at the same time to the answering peer (browser). The answer peer then submits ICE candidates back to the Pion server.

I want to create 2 separate processes. One for the http backend and one for the WS/WebRTC backend. Both processes communicate with each other through Redis pub/sub. The https backend will create a room and store this information in Redis. The client then connects to the Websocket backend and starts the signalling process. Candidates from the browser and answers can be sent through POST requests. These POST requests can be received by the backend and relayed over Redis pub/sub to the SFU.

- How can we run Redis Pub/Sub within Pion's concurrency?
- How many candidates does Pion server create if we set SetNAT1To1IPs?
- Can we transmit candidates together with offer for the server?


## Learnings

- TURN is used to establish a connection between 2 parties by figuring out what public facing IP to use.
- ICE is a protocol that enables 2 parties to message with each other
- We should use the ICE password ("ice-pwd") as a way to authenticate joining a meeting (call join backend -> return ice-pwd -> establish ICE)

# How webrtc works

1. First we create a connection by signalling, during signalling we exchange SDP (Session Description Protocol) between clients one makes an offer, the other accepts with an answer

2. After being in possession of SDP, we attempt to connect. To achieve this, ICE (Interactive Connectivity Establishment) is used. Peers exchange ICE candidates

3. After a connection is established through ICE, security is setup

4. Having completed above steps, we can exchange media over SRTP (Secure Real-time Transport Protocol and data over SCTP (Stream Control Transmission Protocol)

I believe what I'm looking for is a SFU.

- We need a SFU (selective fowarding unit) that broadcasts video to correct peers

In case we do not want the server to figure out ICE candidates through external STUN/TURN we can supply a fixed reachable IP with SetNAT1To1IPs. Also need to set SetLite to true in order to tell the server it's a ICE lite agent.

We can also supply a fixed number of UDP ports with SetEphemeralUDPPortRange. I'm not sure yet how to use the SettingEngine. But both above options are set-able from this place.

In the data-channels detach link under URL's is an eample how to use the SettingEngine.

## URLs

- https://github.com/pion/webrtc/issues/835
- https://github.com/pion/example-webrtc-applications/tree/master/sfu-ws
- https://webrtcforthecurious.com
- https://webrtc.github.io/samples/
- https://github.com/pion/ion-sfu
- https://github.com/pion/webrtc/blob/master/settingengine.go#L134
- https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidateStats/candidateType
- https://github.com/pion/webrtc/blob/master/examples/data-channels-detach/main.go#L24
- https://github.com/pion/webrtc/blob/master/settingengine.go#L116
- https://pkg.go.dev/encoding/gob

## Random thoughts

- Marketing: people can join meetings but only exclusive group can make them
- Emoji URLs?
- SFU IETF informational document: https://tools.ietf.org/html/rfc7667#section-3.7
- Some other SFU: https://news.ycombinator.com/item?id=23523305
- In the future using Go's gob package might be faster than JSON

## Architecture

- The services has different spaces called rooms
- Every room has a single host and an x(= limited to 1 for now) number of participants
- Every host and participate shares audio/video with each other inside a room
- Rooms do not communicate with each other

## External docs

- Marketing thoughts: https://docs.google.com/document/d/14VVOO5hUJ4pbQnMckhnQb6p-LY6x6ArrxO33nrFlUKk/edit#


## Golang to read

# Interfaces
A collection of functions with their parameters grouped together. You can apply these functions to strucs. But it is up to the struct to implent these functions for their own use-case.

# Channels
Allows you to multithread certain functions and return their values back for processing in a thread safe way.

# Context
A way to pass state between functions? 

#URLs

- https://blog.golang.org/concurrency-timeouts
- https://blog.golang.org/context
- https://blog.golang.org/context-and-structs
- https://opensource.com/article/18/7/locks-versus-channels-concurrent-go
- https://gobyexample.com/interfaces
- https://medium.com/rungo/interfaces-in-go-ab1601159b3a
- https://www.alexedwards.net/blog/interfaces-explained


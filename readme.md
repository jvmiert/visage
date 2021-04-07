## Goal

I want to establish a WebRTC connection between a peer and server. The peer then sends their video to the server.
Server takes this video and distributes it to other eligible peers.

## Approach

I want to change my approach. I want to use ION-SFU since it offers so many more features that will improve video quality (now and in the future). In order to maximize video quality a number of techniques need to be implementend: NACK, proper PIL handeling, and Congestion Control. These techniques are all implemented in ion. Next step is:

-   Implement joining of a room (session?)

# Want to work on (30-03-2021)

-   Figure out how transceivers work and properly implement them
-   When we disconnect, we need to remove them from Redis room
    -   Properly leave the room when closing the connection
-   Implement room limit
-   Implement NACK? https://github.com/pion/interceptor
-   Make proper UI flow for selecting devices and output
    -   Select proper webcam/mic: https://webrtc.org/getting-started/media-devices#querying_media_devices
    -   Pass proper media constrains to prevent flopping of resolution: https://webrtc.org/getting-started/media-devices#media_constraints

# Current approach (30-03-2021)

I need to achieve the following:

-   Every time a new peer connects to the server, add the incoming track to trackLocals
-   When a new track is added, figure out what peers need to receive this new incoming track
-   Send new incoming track to peer
-   Signal to peer to re-negotiate in order to receive new track

# Old approach (29-03-2021)

The idea to not use websockets was cute. Sadly it didn't work. Adding websockets now.

# Old approach (28-03-2021)

The old approach works well expect for one fatal flaw. The flaw is that it seems to be impossible to trigger an ICE restart. This is needed in order to reconnect to a room in case of a connect loss or refresh. Right now we browser only makes an answer and the SFU/server makes an offer. We need to switch this around.

In order to switch this around we need to change our architecture. Right now the server offer and candidate is make during the room creation process. This needs to be moved to the joining process.

The new way will:

-   The room creation will only make the room information in Redis
    -   Generate unique room id
    -   Assign the host
-   The joining will have to allow server offer and initial candidate exchange
-   Change the Redis room info structure

# Old approach (27-03-2021):

Pion server creates a PeerConnection and creates and offer for this peer. This PeerConnection needs to be retrievable by a session identification so its state can be updated. Idealy, all the ICE candidates for the server-side can be generated together with the offer and shared at the same time to the answering peer (browser). The answer peer then submits ICE candidates back to the Pion server.

I want to create 2 separate processes. One for the http backend and one for the WS/WebRTC backend. Both processes communicate with each other through Redis pub/sub. The https backend will create a room and store this information in Redis. The client then connects to the Websocket backend and starts the signalling process. Candidates from the browser and answers can be sent through POST requests. These POST requests can be received by the backend and relayed over Redis pub/sub to the SFU.

-   How can we run Redis Pub/Sub within Pion's concurrency? -> it's simple, use a channel that gives you answers
-   How many candidates does Pion server create if we set SetNAT1To1IPs? -> just a single one
-   Can we transmit candidates together with offer for the server?

## Learnings

-   TURN is used to establish a connection between 2 parties by figuring out what public facing IP to use.
-   ICE is a protocol that enables 2 parties to message with each other
-   We should use the ICE password ("ice-pwd") as a way to authenticate joining a meeting (call join backend -> return ice-pwd -> establish ICE)

# How webrtc works

1. First we create a connection by signalling, during signalling we exchange SDP (Session Description Protocol) between clients one makes an offer, the other accepts with an answer

2. After being in possession of SDP, we attempt to connect. To achieve this, ICE (Interactive Connectivity Establishment) is used. Peers exchange ICE candidates

3. After a connection is established through ICE, security is setup

4. Having completed above steps, we can exchange media over SRTP (Secure Real-time Transport Protocol and data over SCTP (Stream Control Transmission Protocol)

I believe what I'm looking for is a SFU.

-   We need a SFU (selective fowarding unit) that broadcasts video to correct peers

In case we do not want the server to figure out ICE candidates through external STUN/TURN we can supply a fixed reachable IP with SetNAT1To1IPs. Also need to set SetLite to true in order to tell the server it's a ICE lite agent.

We can also supply a fixed number of UDP ports with SetEphemeralUDPPortRange. I'm not sure yet how to use the SettingEngine. But both above options are set-able from this place.

In the data-channels detach link under URL's is an eample how to use the SettingEngine.

# ion-SFU

- Sessions are rooms? Every sessions contains a number of Peers that are subscribed to each other?
- A sessions is hosted by a session provider aka a SFU instance?
- When establising a websocket connection -> make a new peer
- When peer wants to join, make an offer and send a join request
    - set OnOffer function in case there is a new offer
    - set OnIceCandidate for new ICE candidates
    - call Peer's Join function with the relevant room


## URLs

-   https://github.com/pion/webrtc/issues/835
-   https://github.com/pion/example-webrtc-applications/tree/master/sfu-ws
-   https://webrtcforthecurious.com
-   https://webrtc.github.io/samples/
-   https://github.com/pion/ion-sfu
-   https://github.com/pion/webrtc/blob/master/settingengine.go#L134
-   https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidateStats/candidateType
-   https://github.com/pion/webrtc/blob/master/examples/data-channels-detach/main.go#L24
-   https://github.com/pion/webrtc/blob/master/settingengine.go#L116
-   https://pkg.go.dev/encoding/gob
-   https://github.com/pion/webrtc/tree/master/examples/simulcast

## Random thoughts

-   Marketing: people can join meetings but only exclusive group can make them
-   Emoji URLs?
-   SFU IETF informational document: https://tools.ietf.org/html/rfc7667#section-3.7
-   Some other SFU: https://news.ycombinator.com/item?id=23523305
-   In the future using Go's gob package might be faster than JSON

## Architecture

-   The services has different spaces called rooms
-   Every room has a single host and an x(= limited to 1 for now) number of participants
-   Every host and participate shares audio/video with each other inside a room
-   Rooms do not communicate with each other

# Room joining process

1. A room needs to be made by calling /room/create
2. This creates a room by setting the room info dict (see below) in Redis
3. The user joins the room, generates an offer and sends it to the backend
4. The backend communicates the offer and waits for the SFU to send a reply answer and candidate
5. The browser receives answer and candidate and shares its own candidates to the backend
6. Backend passes candidates along to SFU
7. ICE is established

# SFU -> redis pub/sub communication

Currently this is used for communicating candidates and answers from SFU to browser

```
Map{
    type (string):
        One of the following:
            - "done" -> when SFU has finished sending candidate and answer
            - "candidate" -> to communicate the server's candidate to browser
            - "answer" -> to communicate the server's answer to browser
    payload
}
```

# Backend -> SFU redis pub/sub communication

```
Map{
    type (string):
        One of the following:
            - "offer"     -> to communicate the browser's offer to the server
            - "candidate" -> when backend receives a candidate
    clientID (string)
    roomID (string)
    payload
}
```

# Redis room info dictionary

```
[room uuid]: {
    occupancyCount:                     int,
    occupants:                          hashmap of peer info (IsHost, IsPresent)
}
```

## External docs

-   Marketing thoughts: https://docs.google.com/document/d/14VVOO5hUJ4pbQnMckhnQb6p-LY6x6ArrxO33nrFlUKk/edit#

## Golang to read

# Interfaces

A collection of functions with their parameters grouped together. You can apply these functions to strucs. But it is up to the struct to implent these functions for their own use-case.

# Channels

Allows you to multithread certain functions and return their values back for processing in a thread safe way.

# Context

A way to pass state between functions? Or concurrency?

#URLs

-   https://blog.golang.org/concurrency-timeouts
-   https://blog.golang.org/context
-   https://blog.golang.org/context-and-structs
-   https://golang.org/pkg/context/
-   https://blog.golang.org/context
-   https://opensource.com/article/18/7/locks-versus-channels-concurrent-go
-   https://gobyexample.com/interfaces
-   https://medium.com/rungo/interfaces-in-go-ab1601159b3a
-   https://www.alexedwards.net/blog/interfaces-explained
-   https://gobyexample.com/json
-   https://rwinslow.com/posts/use-flatbuffers-in-golang/
-   https://github.com/mzaks/FlatBuffersSwift/wiki/FlatBuffers-Explained

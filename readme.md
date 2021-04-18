## Goal

I want to establish a WebRTC connection between a peer and server. The peer then sends their video to the server.
Server takes this video and distributes it to other eligible peers.

## Approach

- Fix issue with having too many mics error
- Handle errors in permission
- Allow for muting and unmuting
- pixel 3 issue: https://github.com/twilio/video-quickstart-android/issues/470

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

-   Sessions are rooms? Every sessions contains a number of Peers that are subscribed to each other?
-   A sessions is hosted by a session provider aka a SFU instance?
-   When establising a websocket connection -> make a new peer
-   When peer wants to join, make an offer and send a join request
    -   set OnOffer function in case there is a new offer
    -   set OnIceCandidate for new ICE candidates
    -   call Peer's Join function with the relevant room

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
-   https://github.com/soheilhy/cmux

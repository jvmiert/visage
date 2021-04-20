# Goal

I want to establish a WebRTC connection between a peer and server. The peer then sends their video to the server.
Server takes this video and distributes it to other eligible peers.

# Approach

Creating a relay. Server receives peer, if logic dictates forward, relay to destination server. Destination server joins peer in its session and vice versa.

-   https://github.com/pion/ion-sfu/pull/486/files
-   https://github.com/pion/ion-sfu/pull/130/files
-   https://gophers.slack.com/archives/C01EVC86FAR/p1610522403247800

- Allow for muting and unmuting
- pixel 3 issue: https://github.com/twilio/video-quickstart-android/issues/470
- maybe implement this: https://github.com/pion/ion-sdk-js/blob/master/src/stream.ts#L268

## To test

I need to validate the idea that you can get higher quality video conversation by relaying peers through servers instead of a single server. 

Figure out if there is meaningful difference between:

Scenario 1:
Peer in EU <- WebRTC -> Singapore <- Relay -> HCM <- WebRTC -> peer in VN

Scenario 2:
Peer in EU <- WebRTC -> HCM <- WebRTC -> peer in VN

Scenario 3:
Peer in EU <- WebRTC -> Singapore <- WebRTC -> peer in VN

Metrics:
- Average video mbit for 1 hour
- Average latency for 1 hour
- Average jitter for 1 hour

# Learnings

-   TURN is used to establish a connection between 2 parties by figuring out what public facing IP to use.
-   ICE is a protocol that enables 2 parties to message with each other
-   We should use the ICE password ("ice-pwd") as a way to authenticate joining a meeting (call join backend -> return ice-pwd -> establish ICE)

# URLs

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

# Random thoughts

-   Marketing: people can join meetings but only exclusive group can make them
-   Emoji URLs?
-   SFU IETF informational document: https://tools.ietf.org/html/rfc7667#section-3.7
-   Some other SFU: https://news.ycombinator.com/item?id=23523305
-   In the future using Go's gob package might be faster than JSON

# Architecture

-   The services has different spaces called rooms
-   Every room has a single host and an x(= limited to 1 for now) number of participants
-   Every host and participate shares audio/video with each other inside a room
-   Rooms do not communicate with each other

## Room joining process

1. A room needs to be made by calling /room/create
2. This creates a room by setting the room info dict (see below) in Redis
3. The user joins the room
4. Video/audio is setup/requested
5. Websocket connection is made -> start signal

## Redis room info dictionary

```
[room uuid]: {
    occupancyCount:                     int,
    occupants:                          hashmap of peer info (IsHost, IsPresent)
}
```

# External docs

-   Marketing thoughts: https://docs.google.com/document/d/14VVOO5hUJ4pbQnMckhnQb6p-LY6x6ArrxO33nrFlUKk/edit#

# Golang to read

## Interfaces

A collection of functions with their parameters grouped together. You can apply these functions to strucs. But it is up to the struct to implent these functions for their own use-case.

## Channels

Allows you to multithread certain functions and return their values back for processing in a thread safe way.

## Context

A way to pass state between functions? Or concurrency?

# URLs

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

# React Native

- https://reactnavigation.org/docs/navigating/
- https://github.com/react-navigation/react-navigation
- https://reactnative.dev/docs/native-modules-android
- https://github.com/react-native-webrtc/react-native-webrtc

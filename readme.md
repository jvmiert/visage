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

## Simulcast

Should implement this. Multiple layers are send from the publisher to the SFU. The subscriber can send a message over the ion SFU API WebRTC datachannel to select a layer (see 2). The SFU processes this message and then switches the layer (see 1).

1. https://github.com/pion/ion-sfu/blob/master/pkg/middlewares/datachannel/subscriberapi.go#L25
2. https://github.com/pion/ion-sdk-js/blob/1a757e38108151eb45ac2202fbe062455dba3646/src/stream.ts#L443
3. https://github.com/pion/ion-sdk-js/blob/master/src/stream.ts#L203
4. https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpEncodingParameters
5. https://github.com/pion/webrtc/tree/master/examples/simulcast
6. https://en.wikipedia.org/wiki/Scalable_Video_Coding
7. http://iphome.hhi.de/wiegand/assets/pdfs/DIC_SVC_07.pdf

## Mobile

It seems right now that in mobile there is a severe restriction when it comes to playing back multiple streams of high quality. I have to figure out how many streams a mobile phone can play back at the same time at what resolution. Then I need to make a system that limits playback resolution on these devices.

## React Native

The big issue is that react native webrtc does not support unified sdp. There is no transceiver or adding of individual tracks. When changing the ion sfu to plan b fallback, signalling works. However no media is exchanged. Another person has managed to get it working:

- https://github.com/cryptagon/ion-cluster-rn/blob/master/App.tsx
- https://github.com/billylindeman/react-native-webrtc/tree/1.87.1-Transceiver-API

Should look into that. Also maybe converting plan-b to unified and vice versa:

- https://github.com/jitsi/sdp-interop

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

## Web frontend device state

When a user wants to join a room in the web frontend it can be in one of the following states:

- Joining a room for the very first time
- Joining for the n-th time with same hardware as n-1 time
- Joining for the n-th time with new hardware

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
- https://github.com/rt2zz/redux-persist
- https://github.com/react-native-async-storage/async-storage

# Server

- https://vnptidc.com/vnpt-cloud/
- https://vnptidc.com/thue-cho-dat-may-chu-vdc/
- https://cloudvnpt.vn/vnpt-cloud/#

# Dev tools

- https://www.charlesproxy.com/documentation/proxying/
- https://www.browserstack.com/guide/how-to-simulate-slow-network-conditions

# Inspiration

- https://tandem.chat/
- https://www.producthunt.com
- https://remo.co/
- https://www.teamflowhq.com

# To-do

## Important
- I want to use global state
    - To keep track of errors and loading states
    - To keep track of setup state
    - To keep track of room state
        - Video
        - Users
- In order to use global state we need to implement global state management
    - Implement Zustand
        - https://github.com/pmndrs/zustand
        - Official nextjs example: https://github.com/vercel/next.js/blob/canary/examples/with-zustand/lib/zustandProvider.js
            - This has issues where state on server side is always the same for every render (user)
        - Implement fixes as discussed here: https://github.com/pmndrs/zustand/issues/182
            - Suggestion to fix: https://github.com/pmndrs/zustand/issues/182#issuecomment-803172558
            - Implemented suggestion: https://github.com/Munawwar/zustand/blob/issue-182-ssr/src/context.ts
    - Use Immer for updating the store's state easier (nested objects)
        - https://github.com/immerjs/immer
        - https://immerjs.github.io/immer/
        - https://immerjs.github.io/immer/update-patterns/
- Use the official ion js sdk with my custom flatbuffers signal as interface
    - https://github.com/pion/ion-sdk-js/blob/master/src/signal/index.ts
- Prevent server side request from running if room is not valid in the room catch all route
- Maybe implement this card for homepage:
    - https://tailwindcomponents.com/component/ui-design-subscription-card
- Implement proper room leaving
    - webrtc and tracks not getting cleaned up currently
- When joining random room from index, no loading state is displayed
- Add permission helper guide when joining room second time
    - Detect if we need to show this popup with the enumerateDevices()
- Add an fscreen event handler when full screen state changes to update UI
    - Currently when the user exits full screen manually the UI state is not updated correctly
- Fix full screen not working on mobile
- Fix Firefox android sending black screen
- Check bundle size
    - https://github.com/vercel/next.js/tree/canary/packages/next-bundle-analyzer
- We currently load all language file, make them load dynamically after loading the initial language

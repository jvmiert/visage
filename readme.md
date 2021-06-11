# Goal

Rooms are where groups of people communicate with each other, share memories, and organize happenings. Rooms persist permanently. When creating a room the user needs to pick a URL and invite friends. Communication happens in rooms through text messages or audio/video.

## Relay
Allow clients to discover which SFU they are geographically closest to. Then connect to this specific SFU. A system needs to be in place that detects if a session contains peers from different geographical regions, and thus different SFUs. When the system detects this it needs to initiate relay and signal to the other SFU. A server to server signalling system needs to be build to exchange offers and answers between SFUs.

1. ~~Allow clients to connect to the correct SFU based on geographical region~~
    - ~~Figure out a way to store available backends~~
        - ~~On backend startup, the server should register in Redis~~
        - ~~When the server shuts down it should deregister in Redis~~
        - ~~Use redis key with expiry to automatically have a health check~~
    - ~~Read backends during signal establishment~~
    - ~~Select most suitable backend~~
2. ~~Keep track of session's geographical situation~~
    - ~~Store NodeInfo in the redis room property~~
        - ~~Make sure we use redsync mutex~~
    - ~~We should store Peer information~~
        - ~~We can replace the current User information or add the peer into the struct~~
3. Monitor above system and act if relay is needed
    - Just do it in the join handler?
4. Create a server-to-server signalling system to establish relay connection
     - Use Redis pub/sub?
5. ???
7. Profit

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
-   https://github.com/davidshimjs/qrcodejs

# Random thoughts

-   Marketing: people can join meetings but only exclusive group can make them
-   Emoji URLs?
-   SFU IETF informational document: https://tools.ietf.org/html/rfc7667#section-3.7
-   Some other SFU: https://news.ycombinator.com/item?id=23523305
-   In the future using Go's gob package might be faster than JSON
-   Make functionality to split the bill?

# External docs

-   Marketing thoughts: https://docs.google.com/document/d/14VVOO5hUJ4pbQnMckhnQb6p-LY6x6ArrxO33nrFlUKk/edit#

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
-   https://gorm.io/docs/
-   https://golang.org/doc/effective_go
-   https://github.com/net-prophet/noiR

# React Native

- https://reactnavigation.org/docs/navigating/
- https://github.com/react-navigation/react-navigation
- https://reactnative.dev/docs/native-modules-android
- https://github.com/react-native-webrtc/react-native-webrtc
- https://github.com/rt2zz/redux-persist
- https://github.com/react-native-async-storage/async-storage
- https://github.com/ocetnik/react-native-background-timer

# Server

- https://vnptidc.com/vnpt-cloud/
- https://vnptidc.com/thue-cho-dat-may-chu-vdc/
- https://cloudvnpt.vn/vnpt-cloud/#

# Dev tools

- https://www.charlesproxy.com/documentation/proxying/
- https://www.browserstack.com/guide/how-to-simulate-slow-network-conditions

# Phones to possible buy for dev/test

- https://www.chotot.com/tp-ho-chi-minh/mua-ban-dien-thoai/oppo-br11-md0
- https://www.chotot.com/tp-ho-chi-minh/mua-ban-dien-thoai/samsung-br2-md0
- https://www.chotot.com/tp-ho-chi-minh/mua-ban-dien-thoai/xiaomi-br15-md0
- https://www.chotot.com/tp-ho-chi-minh/quan-go-vap/mua-ban-dien-thoai/apple-br1-md0

# Inspiration

- https://tandem.chat/
- https://www.producthunt.com
- https://remo.co/
- https://www.teamflowhq.com
- https://quill.chat/
- https://interval.com/
- https://rocket.chat/
- https://rewatch.com/

# Mobile platform marketshare

- iOS: 12.X+ = 80%
- Android: 8.0+ = 70%

# To-do

## Important
- Properly leave room now that we leave signal intact upon room leave
    - Perhaps create a leave room event?
- Add splash screen
- Implement retry logic when ws disconnects
- Setup deep links for ios
- Test H264 vs VP8 cpu usage
- Use GORM for Go ORM?
- Maybe implement this card for homepage:
    - https://tailwindcomponents.com/component/ui-design-subscription-card
- When joining random room from index, no loading state is displayed
- Use absolute imports: https://nextjs.org/docs/advanced-features/module-path-aliases
- Add an fscreen event handler when full screen state changes to update UI
    - Currently when the user exits full screen manually the UI state is not updated correctly
- Fix full screen not working on mobile
- Fix Firefox android sending black screen
- Check bundle size
    - https://github.com/vercel/next.js/tree/canary/packages/next-bundle-analyzer
- We currently load all language file, make them load dynamically after loading the initial language
- pixel 3 issue: https://github.com/twilio/video-quickstart-android/issues/470

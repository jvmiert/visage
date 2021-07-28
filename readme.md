# Goal

Rooms are where groups of people communicate with each other, share memories, and organize happenings. Rooms persist permanently. When creating a room the user needs to pick a URL and invite friends. Communication happens in rooms through text messages or audio/video.

## User
I want to be able to create, store, and retrieve user information. I've decided to use MongoDB because I've never used a NoSQL database other than Redis. Next steps are:

1. ~~Setup application logic to connect to mongodb~~
    - ~~Add a mongo client to SFU struct~~
2. ~~Create user struct~~
    - ~~Make sure we separate it from how we store user info in Redis~~
3. ~~Create endpoint to save a new user~~
    - ~~Use proper validation: https://github.com/go-playground/validator~~
4. - Save user to MongoDB
    - ~~Check if user exists already~~
    - Generate a user id
    - ~~Generate password hash~~
5. - Generate a user session

# URLs
- https://docs.mongodb.com/manual/tutorial/model-embedded-one-to-many-relationships-between-documents/
- https://github.com/mongodb/mongo-go-driver#usage
- https://www.mongodb.com/blog/post/mongodb-go-driver-tutorial
- https://docs.mongodb.com/manual/reference/bson-types/
- https://medium.com/@apzuk3/input-validation-in-golang-bc24cdec1835
- https://www.thepolyglotdeveloper.com/2019/03/validating-data-structures-variables-golang/
- https://github.com/go-playground/validator


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
    - ~~Room global lock wasn't implemented yet~~
    - ~~Rewrite room.go functions to lock on room creation/retrieval and user leave/join~~
3. ~~Monitor above system and act if relay is needed~~
4. ~~Create a server-to-server signalling system to establish relay connection~~
     - ~~Implement redis sub~~
     - ~~Create new relay peer~~
     - ~~Send the result of relay offer over Redis pub/sub~~
     - ~~Process above offer and pass it to answer~~
     - ~~Return the output of answer back to offer~~
     - ~~Somehow listen for above reply in the relay offer function~~
5. ???
7. Profit

## Session issues
I'm having trouble keeping track of room occupants across multiple nodes. The main issue is that there are multiple ways by which a user can leave a room. Namely:

1. A user can send a leave command over websocket
2. The WebRTC connection can close
2. The WebSocket connection can time out

The problems surfaces when a user refreshes the page. The user sends a leave command and the WebSocket connection closes. At the same time the user rejoins. Now we have a race condition where sometimes the user will join before the WebSocket connection is closed. The server then marks the user as left.

Maybe we can use a unique sessions ID that is linked to the WebSocket connection. Then when we make sure that the newly rejoined session is not closed by old sessions.

The question is how do we properly store the sessions that contain region and node information across multiple nodes. Joining is a 2-part process. First a token is requested during which the user information is stored in the room. Second, the user actually joins the room through the websocket channel with the token gained in the first step. The first and second step are performed in different nodes. To properly store node information the join process:

Joining
-----------
1. ~~A session ID is retrieved from the backend~~
2. ~~WebSocket connection is made with the session ID~~
3. ~~The node receiving the above WebSocket connection saves the node and user information in Redis~~
    1. ~~And keeps a local copy of said state?~~
4. ~~A user issues a join request to the backend API with the session ID~~
5. ~~The backend retrieved the session information from step 3 and writes it to Redis room info~~
7. ~~The backend returns the token to the frontend~~
8. ~~A WebSocket join is issued with the token~~

Leaving
-----------
- ~~When a SFU node is shut down, clear local sessions and update Redis~~
    - ~~Update affected rooms too~~
- ~~When a WebSocket connection is disconnected, update sessions and rooms~~
- ~~When a leave command is issued, update room~~


## To test

I need to validate the idea that you can get higher quality video conversation by relaying peers through servers instead of a single server. 

Figure out if there is meaningful difference between:

- Ams -> Singapore
- Ams -> Viettel
- Ams -> Home

Test is with SFU and use metrics endpoint to gather metrics.

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

# Serf
Serf is a way to create a network of nodes that updates which nodes are offline and where they are. It also enables nodes to communicate with each other.

- https://gist.github.com/fsamin/02e3d7b4989d12366481d0de873ec8ee
- https://jacobmartins.com/2017/01/29/practical-golang-building-a-simple-distributed-one-value-database-with-hashicorp-serf/
- https://pkg.go.dev/github.com/hashicorp/serf/serf#pkg-index
- https://fly.io/blog/building-clusters-with-serf/
- https://sites.cs.ucsb.edu/~ravenben/classes/276/papers/vivaldi-sigcomm04.pdf

# Tokens
There are a number of different tokens used within the platform. An illustration of the token process below:
User authenticates -> user token -> session token -> room token -> join room

- After authentication a user receives a `user token`.
- `user token` is used to obtain a `session token`
- A `session token` is used to create a `room token`
- `room token` allows the user to connect to the SFU

# Random URLs

-   https://github.com/davidshimjs/qrcodejs
-   https://github.com/net-prophet/noiR
-   https://github.com/cryptagon/ion-cluster
-   https://www.gstatic.com/duo/papers/duo_e2ee.pdf
-   https://webrtchacks.com/
-   https://ortc.org/architecture/
-   https://webrtchacks.com/first-steps-ortc/
-   https://github.com/livekit/livekit-server
-   https://github.com/golang/go/wiki/CodeReviewComments#error-strings

# Random thoughts

-   Marketing: people can join meetings but only exclusive group can make them
-   Emoji URLs?
-   SFU IETF informational document: https://tools.ietf.org/html/rfc7667#section-3.7
-   Some other SFU: https://news.ycombinator.com/item?id=23523305
-   In the future using Go's gob package might be faster than JSON
-   Make functionality to split the bill?
-   Share files (photos especially) easily

# External docs

-   Marketing thoughts: https://docs.google.com/document/d/14VVOO5hUJ4pbQnMckhnQb6p-LY6x6ArrxO33nrFlUKk/edit#

# Go URLs

-   https://opensource.com/article/18/7/locks-versus-channels-concurrent-go
-   https://www.alexedwards.net/blog/interfaces-explained

# React Native

- https://github.com/react-native-webrtc/react-native-webrtc
- https://github.com/rt2zz/redux-persist
- https://github.com/react-native-async-storage/async-storage
- https://github.com/ocetnik/react-native-background-timer
- https://github.com/andpor/react-native-sqlite-storage
- https://docs.expo.io/versions/latest/sdk/sqlite/

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
- https://livekit.io/
- http://blog.flowdock.com/2017/08/31/the-1-customer-request-has-arrived-re-threading/
- https://blog.discord.com/connect-the-conversation-with-threads-on-discord-3f5fa8b0f6b
- https://zulip.com/help/about-streams-and-topics
- https://docs.mattermost.com/messaging/organizing-conversations.html

# Golang inspiration projects

- https://github.com/heroiclabs/Nakama
- https://github.com/getfider/fider
- https://github.com/mattermost/mattermost-server
- https://github.com/cockroachdb/cockroach

# Mobile platform marketshare

- iOS: 12.X+ = 80%
- Android: 8.0+ = 70%

# To-do

## Important
- Currently when a room has 4 users and 1 users refreshes it will fail due to room limit
    - This is because we count sessions in a room
- Notify backend crashing so we can restart it or print error?
    - https://stackoverflow.com/questions/55273965/how-to-know-if-goroutine-still-exist
- Add splash screen
- Setup next 11
    - For eslint aka next lint
- Implement retry logic when ws disconnects
- Setup deep links for ios
- Change backend fmt.Println to logger
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

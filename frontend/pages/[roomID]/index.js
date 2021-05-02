import { useEffect, /*useRef,*/ useState, useCallback } from "react";
import axios from "axios";
import fscreen from "fscreen";
import Cookies from "cookies";
import { useRouter } from "next/router";
import Link from "next/link";

//import { Client, LocalStream } from "ion-sdk-js";
//const { Client, LocalStream } = require("ion-sdk-js");

import { IonSFUFlatbuffersSignal } from "../../lib/ion";
import { useStore } from "../../lib/zustandProvider";

import VideoElement from "../../components/VideoElement";

import { vidConstrains, audioConstrains } from "../../components/RoomSetup";

export default function RoomView({ data }) {
  const router = useRouter();
  const room = router.query.roomID;

  const addTrack = useStore(useCallback((state) => state.addTrack, []));
  const addStream = useStore(useCallback((state) => state.addStream, []));
  const removeStream = useStore(useCallback((state) => state.removeStream, []));

  const inRoom = useStore(useCallback((state) => state.inRoom, []));
  const currentVideoStream = useStore(
    useCallback((state) => state.currentVideoStream, [])
  );

  const streams = useStore(useCallback((state) => state.streams, []));

  const storedClient = useStore(useCallback((state) => state.client, []));

  const set = useStore(useCallback((state) => state.set, []));

  const invalidRoom = room.match(
    /[^A-Za-z0-9ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ-]+/g
  );

  const [state, setState] = useState({
    loading: true,
    notExist: data.notExist ? true : false,
    isHost: data.isHost,
    wsToken: data.wsToken,
  });

  const loadIon = useCallback(
    async (room, token, stream) => {
      const { Client, LocalStream } = require("ion-sdk-js");
      const signal = new IonSFUFlatbuffersSignal(room, token);
      const client = new Client(signal, {
        codec: "vp8",
        sdpSemantics: "unified-plan",
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      set((state) => {
        state.client = client;
      });

      signal.onopen = async () => {
        await client.join(room, token);

        const ionStream = new LocalStream(stream, {
          resolution: "hd",
          codec: "vp8",
          audio: true,
          video: true,
          simulcast: false,
        });

        client.publish(ionStream);

        addStream(stream);

        client.transports[1].pc.ontrack = (e) => {
          if (e.track.kind === "video") {
            addStream(e.streams[0]);
          }

          e.streams[0].onremovetrack = () => {
            removeStream(e.streams[0]);
          };
        };
        setState((prevState) => ({
          ...prevState,
          ...{
            loading: false,
          },
        }));
      };
    },
    [addStream, removeStream, set]
  );

  useEffect(() => {
    const cleanClient = storedClient;

    return function cleanup() {
      cleanClient && cleanClient.close();
    };
  }, [storedClient]);

  useEffect(() => {
    return function cleanup() {
      set((state) => {
        state.inRoom = false;
      });
      set((state) => {
        state.streams = [];
      });
      set((state) => {
        state.currentVideoStream = null;
      });
    };
  }, [set]);

  useEffect(() => {
    const cleanStream = currentVideoStream;
    return function cleanup() {
      if (cleanStream) {
        cleanStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [currentVideoStream]);

  useEffect(() => {
    console.log(!inRoom);
    if (data.wsToken) {
      if (typeof window !== "undefined" && !inRoom) {
        const vidId = localStorage.getItem("visageVideoId");
        const audId = localStorage.getItem("visageAudioId");

        if ((!vidId || !audId) && !currentVideoStream) {
          router.replace(`${router.asPath}/setup`);
          return;
        }

        set((state) => {
          state.inRoom = true;
        });

        if (currentVideoStream) {
          loadIon(room, data.wsToken, currentVideoStream);
          return;
        }

        navigator.mediaDevices
          .getUserMedia({
            video: {
              ...vidConstrains,
              ...{ deviceId: { exact: vidId } },
            },
            audio: {
              ...audioConstrains,
              ...{ deviceId: { exact: audId } },
            },
          })
          .then((stream) => {
            stream.getTracks().forEach((track) => {
              addTrack(
                track.kind,
                { track, stream, label: track.label },
                track.kind === "audio" ? audId : vidId
              );
            });
            set((state) => {
              state.currentVideoStream = stream;
            });
            loadIon(room, data.wsToken, stream);
          });
      }
    }
  }, [room, data, inRoom, router, set, currentVideoStream, loadIon, addTrack]);

  // const toggleFullscreen = (target, streamId) => {
  //   const newStreams = state.streams.map((stream) => {
  //     if (stream.stream.id === streamId && fscreen.fullscreenEnabled) {
  //       let nextFullState = !stream.isFull;

  //       if (stream.isFull) {
  //         fscreen.exitFullscreen().catch(() => (nextFullState = false));
  //       } else {
  //         const grandGrandParent = target.parentNode.parentNode.parentNode;
  //         fscreen.requestFullscreen(grandGrandParent);
  //       }

  //       const updatedStream = {
  //         ...stream,
  //         menuActive: !stream.menuActive,
  //         isFull: nextFullState,
  //       };

  //       return updatedStream;
  //     }

  //     return stream;
  //   });

  //   setState((prevState) => ({
  //     ...prevState,
  //     ...{
  //       streams: newStreams,
  //     },
  //   }));
  // };

  // const toggleMenu = (streamId) => {
  //   const newStreams = state.streams.map((stream) => {
  //     if (stream.stream.id === streamId) {
  //       const updatedStream = {
  //         ...stream,
  //         menuActive: !stream.menuActive,
  //       };

  //       return updatedStream;
  //     }

  //     return stream;
  //   });

  //   setState((prevState) => ({
  //     ...prevState,
  //     ...{
  //       streams: newStreams,
  //     },
  //   }));
  // };

  const renderStreams = () => {
    return streams.map((stream) => (
      <div key={stream.id} className="w-full md:w-1/2 px-4 pt-4">
        <VideoElement
          srcObject={stream}
          autoPlay
          playsInline
          muted={true}
          //onClick={() => toggleMenu(stream.stream.id)}
          className={
            "rounded w-full h-full bg-gray-900 aspect-w-16 aspect-h-9 shadow"
          }
          // todo: add back 100% width, height and black background
        />
        {/*
              todo:
                - Add back conditional full screen button if fullscreen is available
                  - stream.menuActive
                  - toggleFullscreen(e.target, stream.stream.id)
                - Make every video element "minimize-able"
                - When element is minimized, it gets moved to a little bar on the top view
                - The "main video element" is removed
                - When the smaller element in the "little bar" is clicked, it is resored
          **/}
      </div>
    ));
  };

  if (invalidRoom) {
    return (
      <p>
        404, not found <Link href="/">Go Home</Link>
      </p>
    );
  }

  if (state.notExist || state.full) {
    return (
      <p>
        Sorry, this room {state.notExist ? "does not exist." : "is full."}{" "}
        <Link href="/">Go Home</Link>
      </p>
    );
  }

  if (state.loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="flex flex-row flex-wrap w-full">{renderStreams()}</div>
  );
}

export async function getServerSideProps(context) {
  const { req, res } = context;

  const cookies = new Cookies(req, res);

  const room = context.query.roomID;

  let data = {};

  await axios
    .get(`http://localhost:8080/api/room/join/${room}`, {
      withCredentials: true,
      headers: context.req?.headers?.cookie
        ? { cookie: context.req.headers.cookie }
        : undefined,
    })
    .then((result) => {
      if (!result.data.joinable) {
        data = {
          full: true,
        };
        return;
      }
      if (result.headers["set-cookie"]) {
        result.headers["set-cookie"].forEach((cookie) => {
          const valueList = cookie.split(";");
          const cookieName = valueList[0].split("=")[0];
          const cookieValue = valueList[0].split("=")[1];
          const cookieMaxAge = valueList[2].split("=")[1];

          cookies.set(cookieName, cookieValue, {
            httpOnly: true,
            maxAge: cookieMaxAge,
          });
        });
      }
      data = {
        wsToken: result.data.wsToken,
        isHost: result.data.isHost,
      };
    })
    .catch((error) => {
      if (error.response.status === 404) {
        data = { notExist: true };
      }
    });
  return {
    props: {
      data,
    },
  };
}

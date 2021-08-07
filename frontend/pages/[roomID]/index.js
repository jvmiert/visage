import { useEffect, /*useRef,*/ useState, useCallback } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import Link from "next/link";

import { useStore } from "../../lib/store";

import { bestSquare } from "../../lib/helpers";

import VideoElement from "../../components/VideoElement";

import { vidConstrains, audioConstrains } from "../../components/RoomSetup";

export default function RoomView() {
  const router = useRouter();
  const room = router.query.roomID;

  const addTrack = useStore(useCallback((state) => state.addTrack, []));
  const addStream = useStore(useCallback((state) => state.addStream, []));
  const removeStream = useStore(useCallback((state) => state.removeStream, []));

  const updateSpeakers = useStore(
    useCallback((state) => state.updateSpeakers, [])
  );

  const inRoom = useStore(useCallback((state) => state.inRoom, []));
  const currentVideoStream = useStore(
    useCallback((state) => state.currentVideoStream, [])
  );

  const streams = useStore(useCallback((state) => state.streams, []));

  const storedClient = useStore(useCallback((state) => state.client, []));
  const signal = useStore(useCallback((state) => state.signal, []));
  const ready = useStore(useCallback((state) => state.ready, []));

  const set = useStore(useCallback((state) => state.set, []));

  const invalidRoom = room.match(
    /[^A-Za-z0-9ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ-]+/g
  );

  const [state, setState] = useState({
    error: false,
    loading: true,
    notExist: false,
    roomToken: null,
    full: false,
  });

  const [dimensions, setDimensions] = useState({
    height: undefined,
    width: undefined,
  });

  useEffect(() => {
    if (!signal) {
      return;
    }
    if (!ready) {
      return;
    }
    const joinRoom = async () => {
      await axios
        .post(`/api/room/join/${room}`, { session: signal.session })
        .then((result) => {
          setState((prevState) => ({
            ...prevState,
            ...{
              roomToken: result.data,
            },
          }));
        })
        .catch((error) => {
          if (error.response.status === 404) {
            setState((prevState) => ({
              ...prevState,
              ...{
                notExist: true,
              },
            }));
          }
          if (error.response.data.includes("full")) {
            setState((prevState) => ({
              ...prevState,
              ...{
                full: true,
              },
            }));
          }
          setState((prevState) => ({
            ...prevState,
            ...{
              error: true,
            },
          }));
        });
    };

    joinRoom();
  }, [room, signal, ready]);

  const loadIon = useCallback(
    async (roomToken, stream) => {
      const Client = (await import("ion-sdk-js/lib/client")).default;
      const LocalStream = (await import("ion-sdk-js/lib/stream")).LocalStream;

      const client = new Client(signal, {
        codec: "h264",
        sdpSemantics: "unified-plan",
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      client.onspeaker = (speakers) => {
        updateSpeakers(speakers);
      };

      set((state) => {
        state.client = client;
      });

      client.ontrack = (inTrack, inStream) => {
        if (inTrack.kind === "video") {
          addStream(inStream, false);
          //inStream.preferLayer("high");

          inStream.onremovetrack = () => {
            removeStream(inStream);
          };
        }
      };

      await client.join(roomToken, null);

      const ionStream = new LocalStream(stream, {
        resolution: "hd",
        codec: "h264",
        audio: true,
        video: true,
        simulcast: false,
        preferredCodecProfile: "42e01f",
      });

      client.publish(ionStream);

      setTimeout(function () {
        ionStream.updateMediaEncodingParams({ maxBitrate: 8_000_000 });
      }, 5000);

      addStream(ionStream, true);

      setState((prevState) => ({
        ...prevState,
        ...{
          loading: false,
        },
      }));
    },
    [addStream, removeStream, set, setState, signal, updateSpeakers]
  );

  useEffect(() => {
    const cleanClient = storedClient;

    return function cleanup() {
      cleanClient && cleanClient.leave();
    };
  }, [storedClient]);

  useEffect(() => {
    const cleanSignal = signal;

    return function cleanup() {
      cleanSignal && cleanSignal.leave();
    };
  }, [signal]);

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
    if (!signal) {
      return;
    }
    if (state.roomToken) {
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
          loadIon(state.roomToken, currentVideoStream);
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
            loadIon(state.roomToken, stream);
          })
          .catch(() => {
            localStorage.removeItem("visageVideoId");
            localStorage.removeItem("visageAudioId");
            router.replace(`${router.asPath}/setup`);
          });
      }
    }
  }, [
    state.roomToken,
    inRoom,
    router,
    set,
    currentVideoStream,
    loadIon,
    addTrack,
    signal,
  ]);

  useEffect(() => {
    function handleResize() {
      setDimensions({
        height: window.innerHeight,
        width: window.innerWidth,
      });
    }
    if (typeof window !== "undefined") {
      handleResize();
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }
  }, []);

  const getGridStyle = useCallback(() => {
    // @TODO: we need to debounce this

    const streamNumber = streams.length;

    const squareSize = bestSquare(
      dimensions.width - 24,
      dimensions.height - 24,
      streamNumber
    );

    let styleObject = {
      display: "grid",
      gridGap: "8px",
      margin: "8px",
      placeContent: "center",
      width: "100%",
    };

    styleObject.gridTemplateColumns = `repeat(auto-fit, minmax(0,${
      squareSize - 4
    }px))`;
    return styleObject;
  }, [streams, dimensions]);

  if (state.error) {
    return <p>An error happened :(</p>;
  }

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
    <div className={"min-h-screen flex"}>
      <div style={getGridStyle()}>
        {streams.map((stream) => (
          <div key={stream.id} className="w-full m-auto">
            <div
              className={`aspect-w-1 aspect-h-1 rounded-xl overflow-hidden fade-in ${
                stream.speaking ? "border-solid border-2 border-indigo-300" : ""
              }`}
              key={stream.id}
            >
              <VideoElement
                srcObject={stream}
                autoPlay
                playsInline
                muted={stream.muted}
                className={"object-center object-cover"}
              />
            </div>
          </div>
        ))}
        <style jsx global>{`
          body,
          #__next {
            min-height: 100vh;
            background-color: #0b0b0b;
          }

          .fade-in {
            opacity: 1;
            animation-name: fadeInOpacity;
            animation-iteration-count: 1;
            animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            animation-duration: 250ms;
          }

          @keyframes fadeInOpacity {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

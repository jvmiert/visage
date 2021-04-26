import { useEffect, /*useRef,*/ useState, useCallback } from "react";
import axios from "axios";
import fscreen from "fscreen";

import { useRouter } from "next/router";
import Link from "next/link";

import { loadClient } from "../lib/ionClient";
import VideoElement from "../components/VideoElement";

//todo: make sure we do not render this section server?
import {
  vidConstrains,
  audioConstrains,
  RoomSetup,
} from "../components/RoomSetup";

let subCandidates = [];
let pcPub;
let pcSub;

export default function RoomView({ data }) {
  //const mainVideo = useRef(null);
  const router = useRouter();
  const slug = router.query.slug || [];

  const invalidRoom = slug
    .join("/")
    .match(
      /[^A-Za-z0-9ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ-]+/g
    );

  const room = slug.join("");
  const [state, setState] = useState({
    loading: true,
    showVideo: data.showVideo,
    full: data.full ? true : false,
    error: false,
    notExist: data.notExist ? true : false,
    isHost: data.isHost,
    wsToken: data.wsToken,
    streams: [],
    activeStream: null,
    firstTime: true,
    devices: {},
    loadStream: null,
  });

  const loadVideo = useCallback((room, wsToken, loadStream) => {
    loadClient(
      subCandidates,
      pcPub,
      pcSub,
      setState,
      room,
      wsToken,
      loadStream
    );
  }, []);

  useEffect(() => {
    if (data.wsToken) {
      if (typeof window !== "undefined" && state.firstTime) {
        const vidId = localStorage.getItem("visageVideoId");
        const audId = localStorage.getItem("visageAudioId");

        if (vidId && audId) {
          setState((prevState) => ({
            ...prevState,
            ...{
              firstTime: false,
            },
          }));
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
              loadVideo(room, data.wsToken, stream);
            });
        }
      }
    }
  }, [room, loadVideo, data, state.firstTime]);

  // const changeMainVid = (streamId) => {
  //   const stream = state.streams.find((strm) => strm.stream.id == streamId);
  //   mainVideo.current.srcObject = stream.stream;
  //   setState((prevState) => {
  //     return {
  //       ...prevState,
  //       ...{
  //         activeStream: streamId,
  //       },
  //     };
  //   });
  // };

  const finishSetup = (stream) => {
    loadVideo(room, data.wsToken, stream);
  };

  // useEffect(() => {
  //   if (state.streams.length > 0 && !state.activeStream) {
  //     changeMainVid(state.streams[0].stream.id);
  //   }
  // }, [state, changeMainVid]);

  const toggleFullscreen = (target, streamId) => {
    const newStreams = state.streams.map((stream) => {
      if (stream.stream.id === streamId && fscreen.fullscreenEnabled) {
        let nextFullState = !stream.isFull;

        if (stream.isFull) {
          fscreen.exitFullscreen().catch(() => (nextFullState = false));
        } else {
          const grandGrandParent = target.parentNode.parentNode.parentNode;
          fscreen.requestFullscreen(grandGrandParent);
        }

        const updatedStream = {
          ...stream,
          menuActive: !stream.menuActive,
          isFull: nextFullState,
        };

        return updatedStream;
      }

      return stream;
    });

    setState((prevState) => ({
      ...prevState,
      ...{
        streams: newStreams,
      },
    }));
  };

  const toggleMenu = (streamId) => {
    const newStreams = state.streams.map((stream) => {
      if (stream.stream.id === streamId) {
        const updatedStream = {
          ...stream,
          menuActive: !stream.menuActive,
        };

        return updatedStream;
      }

      return stream;
    });

    setState((prevState) => ({
      ...prevState,
      ...{
        streams: newStreams,
      },
    }));
  };

  const renderStreams = () => {
    return state.streams.map((stream) => (
      <div key={stream.stream.id}>
        <div
          style={{
            width: "100%",
            paddingBottom: "56.25%",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
          >
            <VideoElement
              srcObject={stream.stream}
              autoPlay
              playsInline
              muted={stream.muted}
              onClick={() => toggleMenu(stream.stream.id)}
              // todo: add back 100% width, height and black background
            />
          </div>
        </div>
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

  if (state.firstTime) {
    return <RoomSetup finishSetup={finishSetup} />;
  }

  if (state.loading) {
    return <p>Loading...</p>;
  }

  return <div>{renderStreams()}</div>;
}

export async function getServerSideProps(context) {
  const room = context.query.slug.join("");

  let data = {};

  await axios
    .get(`http://localhost:8080/api/room/join/${room}`)
    .then((result) => {
      if (!result.data.joinable) {
        data = {
          full: true,
        };
        return;
      }
      data = {
        showVideo: true,
        wsToken: result.data.wsToken,
        isHost: result.data.isHost,
      };
    })
    .catch((error) => {
      if (error.response.status === 404) {
        data = { notExist: true };
      }
    });
  return { props: { data } };
}

import { useEffect, /*useRef,*/ useState, useCallback } from "react";
import axios from "axios";
import fscreen from "fscreen";

import Cookies from "cookies";

import { useRouter } from "next/router";
import Link from "next/link";

import { loadClient } from "../../lib/ionClient";
import VideoElement from "../../components/VideoElement";

//todo: make sure we do not render this section server?
import {
  vidConstrains,
  audioConstrains,
  RoomSetup,
} from "../../components/RoomSetup";

let subCandidates = [];
let pcPub;
let pcSub;

export default function RoomView({ data }) {
  //const mainVideo = useRef(null);
  const router = useRouter();
  const room = router.query.roomID;

  const invalidRoom = room.match(
    /[^A-Za-z0-9ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ-]+/g
  );

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
      <div key={stream.stream.id} className="w-full md:w-1/2 px-4 pt-4">
        <VideoElement
          srcObject={stream.stream}
          autoPlay
          playsInline
          muted={stream.muted}
          onClick={() => toggleMenu(stream.stream.id)}
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

  if (state.firstTime) {
    return <RoomSetup finishSetup={finishSetup} />;
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
      console.log(result.data.wsToken);
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

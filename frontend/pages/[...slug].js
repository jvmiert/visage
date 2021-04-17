import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";

import { useRouter } from "next/router";
import Link from "next/link";

import { Box, Grid, Text, Sidebar } from "grommet";

import { loadClient } from "../lib/ionClient";
import VideoElement from "../components/VideoElement";

//todo: make sure we do not render this section server?
import RoomSetup from "../components/RoomSetup";

let subCandidates = [];
let pcPub;
let pcSub;

export default function RoomView({ data }) {
  const mainVideo = useRef(null);
  const router = useRouter();
  const slug = router.query.slug || [];

  const invalidRoom = slug
    .join("/")
    .match(
      /[^A-Za-z0-9ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ-]+/g
    );

  if (invalidRoom) {
    return (
      <p>
        404, not found <Link href="/">Go Home</Link>
      </p>
    );
  }

  const room = slug.join("");
  const [state, setState] = useState({
    loading: true,
    showVideo: data.showVideo,
    showThemVideo: false,
    full: data.full ? true : false,
    error: false,
    notExist: data.notExist ? true : false,
    isHost: data.isHost,
    wsToken: data.wsToken,
    streams: [],
    activeStream: null,
    firstTime: true,
    devices: {},
    audioDevice: null,
    videoDevice: null,
  });

  const loadVideo = useCallback((room, wsToken, audioDevice, videoDevice) => {
    loadClient(
      subCandidates,
      pcPub,
      pcSub,
      setState,
      room,
      wsToken,
      audioDevice,
      videoDevice
    );
  }, []);

  useEffect(() => {
    if (data.wsToken) {
      if (typeof window !== "undefined") {
        if (!state.firstTime) {
          loadVideo(room, data.wsToken, state.audioDevice, state.videoDevice);
        }
      }
    }
  }, [room, loadVideo, data, state.audioDevice, state.videoDevice]);

  const changeMainVid = (streamId) => {
    const stream = state.streams.find((strm) => strm.id == streamId);
    mainVideo.current.srcObject = stream;
    setState((prevState) => {
      return {
        ...prevState,
        ...{
          activeStream: streamId,
        },
      };
    });
  };

  const finishSetup = (audioDevice, videoDevice) => {
    setState((prevState) => ({
      ...prevState,
      ...{
        firstTime: false,
        audioDevice,
        videoDevice,
      },
    }));
  };

  useEffect(() => {
    if (state.streams.length > 0 && !state.activeStream) {
      changeMainVid(state.streams[0].id);
    }
  }, [state, changeMainVid]);

  if (state.notExist || state.full) {
    return (
      <p>
        Sorry, this room {state.notExist ? "does not exist." : "is full."}{" "}
        <Link href="/">Go Home</Link>
      </p>
    );
  }

  if (state.firstTime) {
    return <RoomSetup room={room} finishSetup={finishSetup} />;
  }

  if (state.loading) {
    return <p>Loading...</p>;
  }

  return (
    <>
      <Box style={{ display: "none" }}>
        {state.showVideo && (
          <Box
            as={"video"}
            ref={mainVideo}
            autoPlay
            playsInline
            muted
            round={"xsmall"}
            elevation={"small"}
          />
        )}
      </Box>
      <Grid
        pad="small"
        rows={["auto"]}
        columns={["auto", "150px"]}
        gap="medium"
        areas={[
          { name: "left", start: [0, 0], end: [0, 0] },
          { name: "right", start: [1, 0], end: [1, 0] },
        ]}
      >
        <Box gridArea="left" direction="row" wrap>
          {state.streams.map((stream) => (
            <Box pad="small" key={stream.id} width="50%" alignSelf="center">
              <VideoElement
                srcObject={stream}
                autoPlay
                playsInline
                muted
                onClick={() => changeMainVid(stream.id)}
                focusIndicator={false}
                width="100%"
              />
            </Box>
          ))}
        </Box>
        <Sidebar
          gridArea="right"
          background="brand"
          round="small"
          header={<Text wordBreak="break-word">{room.replace("-", " ")}</Text>}
        ></Sidebar>
      </Grid>
    </>
  );
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

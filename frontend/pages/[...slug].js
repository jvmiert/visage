import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";

import { useRouter } from "next/router";
import Link from "next/link";

import { Box, Grid, Text, Sidebar, ResponsiveContext, Stack } from "grommet";
import { Expand } from "grommet-icons";

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
      if (typeof window !== "undefined") {
        if (!state.firstTime) {
          loadVideo(room, data.wsToken, state.loadStream);
        }
      }
    }
  }, [room, loadVideo, data, state.loadStream]);

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
    setState((prevState) => ({
      ...prevState,
      ...{
        firstTime: false,
        loadStream: stream,
      },
    }));
  };

  // useEffect(() => {
  //   if (state.streams.length > 0 && !state.activeStream) {
  //     changeMainVid(state.streams[0].stream.id);
  //   }
  // }, [state, changeMainVid]);

  const requestFullscreen = (target) => {
    const grandGrandParent = target.parentNode.parentNode.parentNode;
    grandGrandParent.requestFullscreen();
  };

  const renderStreams = (size) => {
    return state.streams.map((stream) => (
      <Box
        pad="small"
        key={stream.stream.id}
        width={size === "small" ? "100%" : "50%"}
        alignSelf="center"
      >
        <Stack anchor="center">
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
                //onClick={() => changeMainVid(stream.stream.id)}
                focusIndicator={false}
                width="100%"
                height="100%"
                background="#000"
              />
            </div>
          </div>
          {/*          <Box
            pad="small"
            round
            background="light-1"
            onClick={(e) => requestFullscreen(e.target)}
          >
            <Expand size="large" />
          </Box>*/}
        </Stack>
      </Box>
    ));
  };

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
      {/*      <Box style={{ display: "none" }}>
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
      </Box>*/}
      <ResponsiveContext.Consumer>
        {(size) =>
          size === "small" ? (
            <Box direction="column">{renderStreams(size)}</Box>
          ) : (
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
                {renderStreams(size)}
              </Box>
              <Sidebar
                gridArea="right"
                background="brand"
                round="small"
                header={
                  <Text wordBreak="break-word">{room.replace("-", " ")}</Text>
                }
              ></Sidebar>
            </Grid>
          )
        }
      </ResponsiveContext.Consumer>
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

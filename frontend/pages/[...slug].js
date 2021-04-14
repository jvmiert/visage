import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";

import { useRouter } from "next/router";
import Link from "next/link";

import { Box, Grid } from "grommet";

import { loadClient } from "../lib/ionClient";
import VideoElement from "../components/VideoElement";

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
    return <p>404, not found</p>;
  }

  const room = slug.join("");
  const [state, setState] = useState({
    loading: data.loading,
    showVideo: data.showVideo,
    showThemVideo: false,
    full: data.full,
    error: false,
    notExist: false,
    isHost: data.isHost,
    wsToken: data.wsToken,
    streams: [],
    activeStream: null,
  });

  const loadVideo = useCallback((room, wsToken) => {
    loadClient(subCandidates, pcPub, pcSub, setState, room, wsToken);
  }, []);

  const closeWS = useCallback(() => {
    // pcPub.close();
    // pcSub.close();
  }, []);

  useEffect(() => {
    if (data.wsToken) {
      if (typeof window !== "undefined") {
        loadVideo(room, data.wsToken);
      }
    }

    return () => {
      closeWS();
    };
  }, [room, loadVideo, closeWS, data]);

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

  useEffect(() => {
    if (state.streams.length > 0 && !state.activeStream) {
      changeMainVid(state.streams[0].id);
    }
  }, [state, changeMainVid]);

  return (
    // {(state.notExist || state.full) && (
    //   <p>
    //     Sorry, this room {state.notExist ? "does not exist." : "is full."}{" "}
    //     <Link href="/">Go Home</Link>
    //   </p>
    // )}
    <Grid
      pad="small"
      rows={["auto"]}
      columns={["200px", "auto", "400px"]}
      gap="small"
      areas={[
        { name: "left", start: [0, 0], end: [0, 0] },
        { name: "mid", start: [1, 0], end: [1, 0] },
        { name: "right", start: [2, 0], end: [2, 0] },
      ]}
    >
      <Box gridArea="left">
        <p>{room}</p>
      </Box>
      <Box gridArea="mid">
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
      <Box gridArea="right">
        {state.streams
          .filter((strm) => strm.id !== state.activeStream)
          .map((stream) => (
            <div key={stream.id} onClick={() => changeMainVid(stream.id)}>
              <VideoElement srcObject={stream} autoPlay playsInline muted />
            </div>
          ))}
      </Box>
    </Grid>
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
          loading: false,
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

      data.loading = false;
    });
  return { props: { data } };
}

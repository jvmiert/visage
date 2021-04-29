import { useEffect, useState, useRef, useCallback } from "react";

import { useRouter } from "next/router";

import shallow from "zustand/shallow";
import { useStore } from "../../lib/zustandProvider";

import { t, Trans } from "@lingui/macro";

import { vidConstrains } from "./PermissionSetup";

export function VideoSetup() {
  const set = useStore(useCallback((state) => state.set, []));
  const addTrack = useStore(useCallback((state) => state.addTrack, []));

  const currentVideoStream = useStore(
    useCallback((state) => state.currentVideoStream, [])
  );

  const activeVideo = useStore(useCallback((state) => state.activeVideo, []));

  // todo: wrap in callback
  const videoTracks = useStore((state) => state.tracks.video, shallow);
  const videoDevices = useStore((state) => state.devices.video, shallow);

  const router = useRouter();

  const refVideo = useRef(null);
  const [state, setState] = useState({
    currentVideoStream: null,
    selectedVideoInput: "",
    showVideoArea: false,
    selectedVideo: "",
    selectedAudio: "",
    loading: true,
  });

  const nextStep = () => {
    const { roomID } = router.query;
    //router.push(`/${roomID}/setup/video`);
  };

  const getNewVideo = async (deviceId) => {
    //todo: if chrome, no need to show this
    setState((prev) => ({
      ...prev,
      ...{
        permissionNeeded: true,
      },
    }));

    //todo: handle error
    return new Promise(function (resolve) {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            ...vidConstrains,
            ...{ deviceId: { exact: deviceId } },
          },
          audio: false,
        })
        .then((stream) => {
          const track = stream.getTracks()[0];
          addTrack(track.kind, { track, stream, label: track.label }, deviceId);
          resolve(stream);
        });
    });
  };

  const setupVideo = async (deviceId, tracks) => {
    if (deviceId) {
      let nextStream = videoTracks[deviceId]?.stream;
      if (!nextStream) {
        nextStream = await getNewVideo(deviceId);
      }
      set((state) => {
        state.activeVideo = deviceId;
      });

      set((state) => {
        state.currentVideoStream = nextStream;
      });

      setState((prev) => ({
        ...prev,
        ...{
          showVideoArea: true,
        },
      }));
      return;
    }
    // when we first activate this screen we have already
    // setup the activated device in PermissionSetup.
    const firstTrackKey = [Object.keys(tracks)[0]];
    const selectedTrack = tracks[firstTrackKey];

    if (!selectedTrack) {
      const { roomID } = router.query;
      router.push(`/${roomID}/setup`);
      return;
    }

    set((state) => {
      state.currentVideoStream = selectedTrack.stream;
    });

    setState((prev) => ({
      ...prev,
      ...{
        showVideoArea: true,
      },
    }));
  };

  const refSetupVideo = useRef(setupVideo);

  useEffect(() => {
    if (!state.loading) return;

    refSetupVideo.current(null, videoTracks);
  }, [state.loading, videoTracks]);

  useEffect(() => {
    if (!refVideo.current) return;
    if (!currentVideoStream) return;
    refVideo.current.srcObject = currentVideoStream;
  }, [currentVideoStream, router.query]);

  const changeVidInput = (event) => {
    let inputValue = event.target.value;
    if (refVideo.current) {
      refVideo.current.srcObject = null;
    }
    setupVideo(inputValue, videoTracks);
  };

  const renderOptions = () => {
    // todo: add back webcam icons

    return videoDevices.map((device, index) => (
      <div key={index}>
        <input
          checked={device.id === activeVideo}
          onChange={changeVidInput}
          type="radio"
          value={device.id}
          name={device.label}
        />
        {device.label ? device.label : `Device ${index + 1}`}
      </div>
    ));
  };

  return (
    <div>
      <h1>Checking your video</h1>
      <p>Making sure you look good.</p>

      {videoDevices.length > 1 && (
        <>
          <p margin={{ vertical: "medium" }}>
            It looks like you have more than 1 video device. Select which one
            you want to use:
          </p>
          <div>{renderOptions("video")}</div>
        </>
      )}
      {/* todo: add back loading spinner when webcam is loading */}
      <video
        autoPlay
        playsInline
        muted
        ref={refVideo}
        style={{ display: state.showVideoArea ? null : "none" }}
      />
      <button onClick={() => nextStep(null, null, state.tracks.audio, null)}>
        This looks good
      </button>
    </div>
  );
}

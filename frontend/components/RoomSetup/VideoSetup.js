import { useEffect, useState, useRef, useCallback } from "react";

import { useRouter } from "next/router";

import shallow from "zustand/shallow";
import { useStore } from "../../lib/store";

import { Trans } from "@lingui/macro";

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
    showVideoArea: false,
    loading: true,
  });

  const nextStep = () => {
    const { roomID } = router.query;
    router.push(`/${roomID}/setup/audio`);
  };

  const getNewVideo = async (deviceId) => {
    //todo: show permission helper
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
      router.replace(`/${roomID}/setup`);
      return;
    }

    set((state) => {
      state.currentVideoStream = selectedTrack.stream;
    });

    setState((prev) => ({
      ...prev,
      ...{
        showVideoArea: true,
        loading: false,
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
      <div key={index} className="mb-2">
        <input
          checked={device.id === activeVideo}
          onChange={changeVidInput}
          type="radio"
          value={device.id}
          name={device.label}
          className="mr-2 hover:cursor-pointer"
          id={device.label}
        />
        <label className="hover:cursor-pointer" htmlFor={device.label}>
          {device.label ? device.label : `Device ${index + 1}`}
        </label>
      </div>
    ));
  };

  return (
    <>
      <h1 className="text-xl font-bold mb-4">
        <Trans>Checking your video</Trans>
      </h1>
      <p className="mb-4">
        <Trans>Making sure you look good.</Trans>
      </p>

      {videoDevices.length > 1 && (
        <>
          <p className="mb-4">
            <Trans>
              It looks like you have more than 1 video device. Select which one
              you want to use:
            </Trans>
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
        style={{
          display: state.showVideoArea ? null : "none",
          maxHeight: "50vh",
        }}
        className="rounded my-4 w-full h-full bg-gray-900 aspect-w-16 aspect-h-9 shadow"
      />
      <button
        className="bg-white hover:bg-gray-100 font-semibold py-2 px-4 border rounded shadow-sm"
        onClick={() => nextStep()}
      >
        <Trans>This looks good</Trans>
      </button>
    </>
  );
}

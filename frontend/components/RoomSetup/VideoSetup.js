import { useEffect, useState, useRef, useCallback } from "react";

import { useRouter } from "next/router";

import shallow from "zustand/shallow";
import { useStore } from "../../lib/zustandProvider";

import { t, Trans } from "@lingui/macro";

import { vidConstrains } from "./PermissionSetup";

export function VideoSetup() {
  const addDevice = useStore(useCallback((state) => state.addDevice, []));
  const set = useStore(useCallback((state) => state.set, []));

  const currentVideoStream = useStore(
    useCallback((state) => state.currentVideoStream, [])
  );

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

  const getNewVideo = (label) => {
    //todo: if chrome, no need to show this
    setState((prev) => ({
      ...prev,
      ...{
        permissionNeeded: true,
      },
    }));
    const targetDevice = state.devices.video.find(
      (device) => device.label == label
    );

    navigator.mediaDevices
      .getUserMedia({
        video: {
          ...vidConstrains,
          ...{ deviceId: { exact: targetDevice.id } },
        },
        audio: false,
      })
      .then((stream) => {
        const receivedTrack = stream.getTracks()[0];

        set((state) => {
          state.currentVideoStream = stream;
        });
        setState((prev) => {
          const nextTracks = {
            ...{
              video: {
                ...prev.tracks.video,
                ...{
                  [receivedTrack.getSettings().deviceId]: {
                    track: receivedTrack,
                    stream: stream,
                    label: receivedTrack.label,
                  },
                },
              },
              audio: {
                ...prev.tracks.audio,
              },
            },
          };
          return {
            ...prev,
            ...{
              permissionNeeded: false,
              tracks: nextTracks,
              selectedVideoInput: label,
              selectedVideo: targetDevice.id,
            },
          };
        });
      });
  };

  const setupVideo = (selectedVideo, tracks, videoList) => {
    if (selectedVideo) {
      const nextTrack = Object.entries(tracks).find(
        ([, v]) => v.label == selectedVideo
      );
      if (!nextTrack) {
        getNewVideo(selectedVideo);
        return;
      }
      const selectedDevice = videoList.find(
        (device) => device.label == selectedVideo
      );

      set((state) => {
        state.currentVideoStream = nextTrack[1].stream;
      });

      setState((prev) => ({
        ...prev,
        ...{
          showVideoArea: true,
          selectedVideoInput: selectedVideo,
          selectedVideo: selectedDevice.id,
        },
      }));
      return;
    }
    const firstTrackKey = [Object.keys(tracks)[0]];
    const selectedTrack = tracks[firstTrackKey];

    const selectedDevice = videoList.find(
      (device) => device.label == selectedTrack.label
    );

    set((state) => {
      state.currentVideoStream = selectedTrack.stream;
    });

    setState((prev) => ({
      ...prev,
      ...{
        showVideoArea: true,
        selectedVideoInput: selectedTrack.label,
        selectedVideo: selectedDevice.id,
      },
    }));
  };

  useEffect(() => {
    if (!state.loading) return;

    setupVideo(null, vidTracks, videoList);
  }, [state.loading]);

  useEffect(() => {
    if (!refVideo.current) return;
    if (!currentVideoStream) return;
    refVideo.current.srcObject = currentVideoStream;
  }, [currentVideoStream]);

  const renderOptions = () => {
    // todo: add back webcam icons

    return state.devices.video.map((device, index) => (
      <div key={index}>
        <input
          checked={state.selectedVideo === device.id}
          onChange={changeVidInput}
          type="radio"
          value={device.label}
          name={device.id}
        />{" "}
        {device.label ? device.label : `Device ${index + 1}`}
      </div>
    ));
  };

  const changeVidInput = (event) => {
    let inputValue = event.target.value;
    if (refVideo.current) {
      refVideo.current.srcObject = null;
    }
    setState((prev) => ({
      ...prev,
      ...{
        selectedVideoInput: inputValue,
      },
    }));
    setupVideo(inputValue, state.tracks.video, state.devices.video);
  };

  return (
    <div>
      <h1>Checking your video</h1>
      <p>Making sure you look good.</p>

      {state.devices.video.length > 1 && (
        <>
          <p margin={{ vertical: "medium" }}>
            It looks like you have more than 1 video device. Select which one
            you want to use:
          </p>
          <div>{renderOptions("video")}</div>
        </>
      )}
      {state.showVideoArea && (
        // todo: add back loading spinner when webcam is loading
        <video autoPlay playsInline muted ref={refVideo} />
      )}
      <button onClick={() => nextStep(null, null, state.tracks.audio, null)}>
        This looks good
      </button>
    </div>
  );
}

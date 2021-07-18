import { useEffect, useState, useRef, useCallback } from "react";

import { useRouter } from "next/router";

import shallow from "zustand/shallow";
import { useStore } from "../../lib/store";

import { Trans } from "@lingui/macro";

import { audioConstrains } from "./PermissionSetup";

export function AudioSetup() {
  const set = useStore(useCallback((state) => state.set, []));
  const addTrack = useStore(useCallback((state) => state.addTrack, []));
  const removeTrack = useStore(useCallback((state) => state.removeTrack, []));

  const activeVideo = useStore(useCallback((state) => state.activeVideo, []));
  const activeAudio = useStore(useCallback((state) => state.activeAudio, []));

  const videoTracks = useStore(useCallback((state) => state.tracks.video, []));
  const audioTracks = useStore(useCallback((state) => state.tracks.audio, []));

  const currentVideoStream = useStore(
    useCallback((state) => state.currentVideoStream, [])
  );
  const currentAudioStream = useStore(
    useCallback((state) => state.currentAudioStream, [])
  );

  const audioDevices = useStore((state) => state.devices.audio, shallow);

  const router = useRouter();

  const refCanvas = useRef(null);
  const refAudioContext = useRef(null);
  const [state, setState] = useState({
    showAudioArea: false,
    loading: true,
  });

  const nextStep = () => {
    if (activeVideo !== "" && activeAudio !== "") {
      localStorage.setItem("visageVideoId", activeVideo);
      localStorage.setItem("visageAudioId", activeAudio);
    }

    const selectedAudio = currentAudioStream.getAudioTracks()[0];
    const selectedVideo = currentVideoStream.getVideoTracks()[0];

    const audioInVideo = currentVideoStream
      .getTracks()
      .find((t) => t.id == selectedAudio.id);

    if (!audioInVideo) {
      currentVideoStream.addTrack(selectedAudio);
    }

    Object.entries(videoTracks).forEach(([key, value]) => {
      value.stream.getTracks().forEach((track) => {
        if (track.id != selectedAudio.id && track.id != selectedVideo.id) {
          track.stop();
          removeTrack(track.kind, key);
        }
      });
    });

    const { roomID } = router.query;
    router.push(`/${roomID}`);
  };

  const getNewAudio = async (deviceId) => {
    //todo: only stop tracks in firefox
    const firstTrackKey = [Object.keys(audioTracks)[0]];
    const activeTrack = audioTracks[firstTrackKey].track;

    //todo: show permission helper

    activeTrack.stop();

    removeTrack("audio", activeAudio);

    //todo: handle error
    return new Promise(function (resolve) {
      setTimeout(() => {
        navigator.mediaDevices
          .getUserMedia({
            audio: {
              ...audioConstrains,
              ...{ deviceId: { exact: deviceId } },
            },
            video: false,
          })
          .then((stream) => {
            const track = stream.getTracks()[0];
            addTrack(
              track.kind,
              { track, stream, label: track.label },
              deviceId
            );
            resolve(stream);
          });
      });
    }, 200);
  };

  const setupAudio = async (deviceId, tracks) => {
    if (deviceId) {
      const nextStream = await getNewAudio(deviceId);

      set((state) => {
        state.activeAudio = deviceId;
      });

      set((state) => {
        state.currentAudioStream = nextStream;
      });

      setState((prev) => ({
        ...prev,
        ...{
          showMicArea: true,
        },
      }));
      return;
    }

    const firstTrackKey = [Object.keys(tracks)[0]];
    const selectedTrack = tracks[firstTrackKey];

    if (!selectedTrack) {
      const { roomID } = router.query;
      router.replace(`/${roomID}/setup`);
      return;
    }

    set((state) => {
      state.currentAudioStream = selectedTrack.stream;
    });

    setState((prev) => ({
      ...prev,
      ...{
        showMicArea: true,
        loading: false,
      },
    }));
  };

  const refSetupAudio = useRef(setupAudio);

  useEffect(() => {
    if (!state.loading) return;

    refSetupAudio.current(null, audioTracks);
  }, [state.loading, audioTracks]);

  useEffect(() => {
    if (!currentAudioStream) {
      return;
    }

    if (!refCanvas.current) {
      return;
    }

    if (refAudioContext.current) {
      refAudioContext.current.close();
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;

    refAudioContext.current = new AudioContext();
    let analyser = refAudioContext.current.createAnalyser();
    let microphone =
      refAudioContext.current.createMediaStreamSource(currentAudioStream);
    let javascriptNode = refAudioContext.current.createScriptProcessor(
      2048,
      1,
      1
    );

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(refAudioContext.current.destination);

    const canvasContext = refCanvas.current.getContext("2d");

    javascriptNode.onaudioprocess = function () {
      var array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      var values = 0;

      var length = array.length;
      for (var i = 0; i < length; i++) {
        values += array[i];
      }

      var average = values / length;

      canvasContext.clearRect(0, 0, 75, 300);
      canvasContext.fillStyle = "#818CF8";
      canvasContext.fillRect(0, 300, 75, -50 - average);
    };
  }, [currentAudioStream, router.query]);

  const changeAudioInput = (event) => {
    let inputValue = event.target.value;
    setupAudio(inputValue, audioTracks);
  };

  const renderOptions = () => {
    // todo: add back mic icon back

    return audioDevices.map((device, index) => (
      <div key={index} className="mb-2">
        <input
          checked={device.id === activeAudio}
          onChange={changeAudioInput}
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
        <Trans>Mic check 1, 2, 3</Trans>
      </h1>
      <p className="mb-4">
        <Trans>Making sure you can be heard.</Trans>
      </p>
      {audioDevices.length > 1 && (
        <>
          <p className="mb-4">
            <Trans>
              It looks like you have more than 1 audio device. Select which one
              you want to use:
            </Trans>
          </p>
          <div>{renderOptions()}</div>
        </>
      )}
      {state.showMicArea && (
        <p className="mb-4">
          <Trans>
            If you see the bar moving when you talk, it means you are ready. If
            the bar does not move, pick another device.
          </Trans>
        </p>
      )}
      <div style={{ display: state.showMicArea ? null : "none" }}>
        <canvas
          className="mx-auto my-4"
          ref={refCanvas}
          width="75"
          height="300"
        />
      </div>
      <button
        id="audio-accept-button"
        className="bg-white hover:bg-gray-100 font-semibold py-2 px-4 border rounded shadow-sm"
        onClick={() => nextStep()}
      >
        I'm ready
      </button>
    </>
  );
}

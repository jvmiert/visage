import { useEffect, useState, useRef } from "react";

import { t, Trans } from "@lingui/macro";

const SetupState = {
  WELCOME: { name: t`Give Permission`, order: 0 },
  VIDEO: { name: t`Check Video`, order: 1 },
  AUDIO: { name: t`Check Audio`, order: 2 },
};

export const vidConstrains = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  aspectRatio: { ideal: 1.777777778 },
  frameRate: {
    ideal: 30,
    max: 100,
  },
};

export const audioConstrains = {
  sampleSize: { ideal: 24 },
  channelCount: { ideal: 2 },
  autoGainControl: { ideal: true },
  noiseSuppression: { ideal: true },
  sampleRate: { ideal: 44100 },
};

//todo: figure out what happens when resolution constraint is not available
//todo: handle permissions rejection
//todo: figure out if and how we can store device selection

export function RoomSetup({ finishSetup }) {
  const refVideo = useRef(null);
  const refCanvas = useRef(null);
  const refAudioContext = useRef(null);
  const [state, setState] = useState({
    setupState: SetupState.WELCOME,
    devices: {},
    permissionNeeded: false,
    tracks: { audio: {}, video: {} },
    streams: [],
    audioContext: null,
    currentVideoStream: null,
    currentAudioStream: null,
    selectedVideoInput: "",
    selectedAudioInput: "",
    listedDevices: false,
    showVideoArea: false,
    showMicArea: false,
    selectedVideo: "",
    selectedAudio: "",
  });

  const stopStreams = (audioKeepId, vidKeepId) => {
    Object.entries(state.tracks.audio).forEach(([, value]) => {
      value.stream.getTracks().forEach((track) => {
        if (track.id != audioKeepId && track.id != vidKeepId) track.stop();
      });
    });

    Object.entries(state.tracks.video).forEach(([, value]) => {
      value.stream.getTracks().forEach((track) => {
        if (track.id != audioKeepId && track.id != vidKeepId) track.stop();
      });
    });
  };

  const nextStep = (stream, vidTracks, audioTracks, videoList) => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    if (state.setupState.name === SetupState.WELCOME.name) {
      setState((prev) => ({
        ...prev,
        ...{
          setupState: SetupState.VIDEO,
        },
      }));
      setupVideo(null, vidTracks, videoList);
    }
    if (state.setupState.name === SetupState.VIDEO.name) {
      setState((prev) => ({
        ...prev,
        ...{
          setupState: SetupState.AUDIO,
        },
      }));
      setupAudio(refCanvas, null, audioTracks, null);
    }
    if (state.setupState.name === SetupState.AUDIO.name) {
      if (state.selectedVideo !== "") {
        localStorage.setItem("visageVideoId", state.selectedVideo);
      }
      if (state.selectedAudio !== "") {
        localStorage.setItem("visageAudioId", state.selectedAudio);
      }

      let singleStream = false;

      const selectedAudio = state.currentAudioStream.getAudioTracks()[0];
      const selectedVideo = state.currentVideoStream.getVideoTracks()[0];

      const audioInVideo = state.currentVideoStream
        .getTracks()
        .find((el) => el.id == selectedAudio.id);

      if (audioInVideo) {
        singleStream = true;
      }

      // stop audio tracks that were not selected
      state.currentVideoStream.getAudioTracks().forEach((track) => {
        if (track.id != selectedAudio.id) {
          track.stop();
          state.currentVideoStream.removeTrack(track);
        }
      });

      // video and audio track were in a single stream
      if (singleStream) {
        stopStreams(selectedAudio.id, selectedVideo.id);
        finishSetup(state.currentVideoStream);
        return;
      }

      state.currentVideoStream.addTrack(selectedAudio);

      stopStreams(selectedAudio.id, selectedVideo.id);
      finishSetup(state.currentVideoStream);
    }
  };

  const getDeviceList = async () => {
    let havePermission = false;
    await navigator.mediaDevices.enumerateDevices().then(function (devices) {
      devices.forEach(function (device) {
        if (device.label) {
          havePermission = true;
        }
      });
    });
    if (!havePermission) {
      setState((prev) => ({
        ...prev,
        ...{
          permissionNeeded: true,
        },
      }));
    }
    navigator.mediaDevices
      .getUserMedia({
        video: vidConstrains,
        audio: audioConstrains,
      })
      .then((stream) => {
        let nextTracks = { audio: {}, video: {} };
        stream.getTracks().forEach((track) => {
          //console.log(track);
          const gotKey = track.kind === "video" ? "video" : "audio";
          nextTracks[gotKey][track.getSettings().deviceId] = {
            track,
            stream: stream,
            label: track.label,
          };
        });
        navigator.mediaDevices
          .enumerateDevices()
          .then(function (devices) {
            let audioList = [];
            let videoList = [];
            devices.forEach(function (device) {
              //console.log(device);
              const deviceInfo = {
                label: device.label,
                id: device.deviceId,
              };
              device.kind === "videoinput" && videoList.push(deviceInfo);
              device.kind === "audioinput" && audioList.push(deviceInfo);
            });
            setState((prev) => ({
              ...prev,
              ...{
                devices: {
                  audio: audioList,
                  video: videoList,
                },
                permissionNeeded: false,
                listedDevices: true,
                tracks: nextTracks,
              },
            }));
            nextStep(null, nextTracks.video, null, videoList);
          })
          .catch(function (err) {
            console.log("mediaDevices error:", err);
          });
      })
      .catch(function (err) {
        console.log("mediaDevices error:", err);
      });
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
              currentVideoStream: stream,
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

      setState((prev) => ({
        ...prev,
        ...{
          currentVideoStream: nextTrack[1].stream,
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

    setState((prev) => ({
      ...prev,
      ...{
        currentVideoStream: selectedTrack.stream,
        showVideoArea: true,
        selectedVideoInput: selectedTrack.label,
        selectedVideo: selectedDevice.id,
      },
    }));
  };

  const getNewAudio = (label, audioTracks) => {
    //todo: only stop tracks in firefox
    const firstTrackKey = [Object.keys(audioTracks)[0]];
    const activeTrack = audioTracks[firstTrackKey].track;

    //todo: if chrome, no need to set permissionNeeded to true
    setState((prev) => ({
      ...prev,
      ...{
        permissionNeeded: true,
      },
    }));

    activeTrack.stop();

    const targetDevice = state.devices.audio.find(
      (device) => device.label == label
    );

    // delay a bit to prevent multiple mics being active
    // and firefox freaking out?
    setTimeout(() => {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            ...audioConstrains,
            ...{ deviceId: { exact: targetDevice.id } },
          },
          video: false,
        })
        .then((stream) => {
          const receivedTrack = stream.getTracks()[0];
          setState((prev) => {
            const nextTracks = {
              ...{
                audio: {
                  ...{
                    [receivedTrack.getSettings().deviceId]: {
                      track: receivedTrack,
                      stream: stream,
                      label: receivedTrack.label,
                    },
                  },
                },
                video: {
                  ...prev.tracks.video,
                },
              },
            };
            return {
              ...prev,
              ...{
                permissionNeeded: false,
                tracks: nextTracks,
                currentAudioStream: stream,
                selectedAudioInput: label,
                selectedAudio: targetDevice.id,
              },
            };
          });
        });
    }, 200);
  };

  const setupAudio = (canvas, selectedAudio, tracks) => {
    if (selectedAudio) {
      const nextTrack = Object.entries(tracks).find(
        ([, v]) => v.label == selectedAudio
      );
      if (!nextTrack) {
        getNewAudio(selectedAudio, tracks);
        return;
      }
      const selectedDevice = state.devices.audio.find(
        (device) => device.label == selectedAudio
      );
      setState((prev) => ({
        ...prev,
        ...{
          currentAudioStream: nextTrack[1].stream,
          showMicArea: true,
          selectedAudioInput: selectedAudio,
          selectedAudio: selectedDevice.id,
        },
      }));
      return;
    }

    const firstTrackKey = [Object.keys(tracks)[0]];
    const selectedTrack = tracks[firstTrackKey];

    const selectedDevice = state.devices.audio.find(
      (device) => device.label == selectedTrack.label
    );

    setState((prev) => ({
      ...prev,
      ...{
        selectedAudioInput: selectedTrack.label,
        showMicArea: true,
        currentAudioStream: selectedTrack.stream,
        selectedAudio: selectedDevice.id,
      },
    }));
  };

  useEffect(() => {
    if (!refVideo.current) return;
    if (!state.currentVideoStream) return;
    refVideo.current.srcObject = state.currentVideoStream;
  }, [state.currentVideoStream]);

  useEffect(() => {
    if (!state.currentAudioStream) {
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
    let microphone = refAudioContext.current.createMediaStreamSource(
      state.currentAudioStream
    );
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
      canvasContext.fillStyle = "#FF0000";
      canvasContext.fillRect(0, 300, 75, -50 - average);
    };
  }, [state.currentAudioStream]);

  const renderOptions = (type) => {
    // todo: add back mic and webcam icons

    const list = type === "video" ? state.devices.video : state.devices.audio;
    const changeFunc = type === "video" ? changeVidInput : changeAudioInput;
    const targetState =
      type === "video" ? state.selectedVideo : state.selectedAudio;

    return list.map((device, index) => (
      <div key={index}>
        <input
          checked={targetState === device.id}
          onChange={changeFunc}
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

  const changeAudioInput = (event) => {
    let inputValue = event.target.value;
    setState((prev) => ({
      ...prev,
      ...{
        selectedAudioInput: inputValue,
      },
    }));
    setupAudio(refCanvas, inputValue, state.tracks.audio);
  };

  const renderStep = () => {
    if (state.setupState.name === SetupState.AUDIO.name) {
      return (
        <>
          <h1>
            <i>Mic check 1, 2, 3</i>
          </h1>
          <p>Making sure you can be heard.</p>
          {state.devices.audio.length > 1 && (
            <>
              <p margin={{ vertical: "medium" }}>
                It looks like you have more than 1 audio device. Select which
                one you want to use:
              </p>
              <div>{renderOptions("audio")}</div>
            </>
          )}
          {state.showMicArea && (
            <p margin={{ horizontal: "none", vertical: "xsmall" }}>
              If you see the bar moving when you talk, it means you are ready.
              If the bar does not move, pick another device.
            </p>
          )}
          <div style={{ display: state.showMicArea ? null : "none" }}>
            <canvas ref={refCanvas} width="75" height="300" />
          </div>
          <button onClick={() => nextStep()}>I'm ready</button>
        </>
      );
    }

    if (state.setupState.name === SetupState.VIDEO.name) {
      return (
        <>
          <h1>Checking your video</h1>
          <p>Making sure you look good.</p>

          {state.devices.video.length > 1 && (
            <>
              <p margin={{ vertical: "medium" }}>
                It looks like you have more than 1 video device. Select which
                one you want to use:
              </p>
              <div>{renderOptions("video")}</div>
            </>
          )}
          {state.showVideoArea && (
            // todo: add back loading spinner when webcam is loading
            <video autoPlay playsInline muted ref={refVideo} />
          )}
          <button
            onClick={() => nextStep(null, null, state.tracks.audio, null)}
          >
            This looks good
          </button>
        </>
      );
    }

    if (state.setupState.name === SetupState.WELCOME.name) {
      return (
        <>
          <h1>
            <i>A warm welcome!</i>
          </h1>
          <p>
            Looks like this is the first time you are joining a room. Let&apos;s
            make sure your audio and video are ready.
          </p>
          {!state.listedDevices && (
            <>
              <p>
                In order to setup your devices, we need your permission. When
                you are ready click the button below
              </p>
              <button onClick={getDeviceList}>Give permission</button>
            </>
          )}
        </>
      );
    }
  };

  return (
    <div>
      {Object.entries(SetupState).map(([key, val]) => (
        <li key={key}>
          {val.name} {val.order} {`${state.setupState.order >= val.order}`}
        </li>
      ))}
      {
        //todo: add back the overlay, loading indicator, arrow indicator
        state.permissionNeeded && (
          <div>
            <p>If you see a request, please allow it </p>
          </div>
        )
      }
      {renderStep()}
    </div>
  );
}

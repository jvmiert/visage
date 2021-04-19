import { useEffect, useState, useRef, useCallback } from "react";

import {
  base,
  Box,
  Heading,
  Text,
  Button,
  Layer,
  Spinner,
  Stack,
  RadioButtonGroup,
  Paragraph,
} from "grommet";
import { LinkUp, Webcam, Microphone } from "grommet-icons";

const SetupState = {
  WELCOME: "welcome",
  VIDEO: "video",
  AUDIO: "audio",
};

const vidConstrains = {
  codec: "h264",
  width: { ideal: 1920 },
  aspectRatio: { ideal: 1.777777778 },
  frameRate: {
    ideal: 30,
    max: 100,
  },
};

const audioConstrains = {
  sampleSize: { ideal: 24 },
  channelCount: { ideal: 2 },
  autoGainControl: { ideal: true },
  noiseSuppression: { ideal: true },
  sampleRate: { ideal: 44100 },
};

//todo: figure out what happens when resolution constraint is not available
//todo: handle permissions rejection
//todo: figure out if and how we can store device selection

function RoomSetup({ room, finishSetup }) {
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

  const nextStep = (stream, vidTracks, audioTracks) => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    if (state.setupState === SetupState.WELCOME) {
      setState((prev) => ({
        ...prev,
        ...{
          setupState: SetupState.VIDEO,
        },
      }));
      setupVideo(null, vidTracks);
    }
    if (state.setupState === SetupState.VIDEO) {
      setState((prev) => ({
        ...prev,
        ...{
          setupState: SetupState.AUDIO,
        },
      }));
      setupAudio(refCanvas, null, audioTracks, null);
    }
    if (state.setupState === SetupState.AUDIO) {
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
        codec: "h264",
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
            nextStep(null, nextTracks.video, null);
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
            },
          };
        });
      });
  };

  const setupVideo = (selectedVideo, tracks) => {
    if (selectedVideo) {
      const nextTrack = Object.entries(tracks).find(
        ([, v]) => v.label == selectedVideo
      );
      if (!nextTrack) {
        getNewVideo(selectedVideo);
        return;
      }
      setState((prev) => ({
        ...prev,
        ...{
          currentVideoStream: nextTrack[1].stream,
          showVideoArea: true,
          selectedVideoInput: selectedVideo,
        },
      }));
      return;
    }
    const firstTrackKey = [Object.keys(tracks)[0]];
    const selectedTrack = tracks[firstTrackKey];
    setState((prev) => ({
      ...prev,
      ...{
        currentVideoStream: selectedTrack.stream,
        showVideoArea: true,
        selectedVideoInput: selectedTrack.label,
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
      setState((prev) => ({
        ...prev,
        ...{
          currentAudioStream: nextTrack[1].stream,
          showMicArea: true,
          selectedAudioInput: selectedAudio,
        },
      }));
      return;
    }

    const firstTrackKey = [Object.keys(tracks)[0]];
    const selectedTrack = tracks[firstTrackKey];

    setState((prev) => ({
      ...prev,
      ...{
        selectedAudioInput: selectedTrack.label,
        showMicArea: true,
        currentAudioStream: selectedTrack.stream,
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
      canvasContext.fillStyle = base.global.colors["accent-2"];
      canvasContext.fillRect(0, 300, 75, -50 - average);
    };
  }, [state.currentAudioStream]);

  const renderOptions = (type) => {
    const icon =
      type === "video" ? (
        <Webcam color="accent-2" />
      ) : (
        <Microphone color="accent-2" />
      );

    const list = type === "video" ? state.devices.video : state.devices.audio;
    return list.map((device, index) => ({
      disabled: false,
      id: device.id,
      name: device.id,
      value: device.label,
      label: (
        <Box direction="row">
          {icon}
          <Text margin={{ left: "xsmall" }}>
            {device.label ? device.label : `Device ${index + 1}`}
          </Text>
        </Box>
      ),
    }));
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
    setupVideo(inputValue, state.tracks.video);
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
    if (state.setupState === SetupState.AUDIO) {
      return (
        <>
          <Heading level={3} margin="none">
            <i>Mic check 1, 2, 3</i>
          </Heading>
          <Text>Making sure you can be heard.</Text>
          {state.devices.audio.length > 1 && (
            <>
              <Text margin={{ vertical: "medium" }}>
                It looks like you have more than 1 audio device. Select which
                one you want to use:
              </Text>
              <RadioButtonGroup
                margin={{ bottom: "medium" }}
                name="audioChoice"
                options={renderOptions("audio")}
                value={state.selectedAudioInput}
                onChange={changeAudioInput}
              />
            </>
          )}
          {state.showMicArea && (
            <Paragraph margin={{ horizontal: "none", vertical: "xsmall" }}>
              If you see the bar moving when you talk, it means you are ready.
              If the bar does not move, pick another device.
            </Paragraph>
          )}
          <Box
            width="medium"
            direction="row"
            justify="center"
            round={"xsmall"}
            border={{
              color: "accent-1",
              size: "large",
              style: "solid",
              side: "all",
            }}
            margin={{ vertical: "medium" }}
            style={{ display: state.showMicArea ? null : "none" }}
          >
            <canvas ref={refCanvas} width="75" height="300" />
          </Box>
          <Button primary label="I'm ready" onClick={() => nextStep()} />
        </>
      );
    }

    if (state.setupState === SetupState.VIDEO) {
      return (
        <>
          <Heading level={3} margin="none">
            Checking your video
          </Heading>
          <Text>Making sure you look good.</Text>

          {state.devices.video.length > 1 && (
            <>
              <Text margin={{ vertical: "medium" }}>
                It looks like you have more than 1 video device. Select which
                one you want to use:
              </Text>
              <RadioButtonGroup
                margin={{ bottom: "medium" }}
                name="videoChoice"
                options={renderOptions("video")}
                value={state.selectedVideoInput}
                onChange={changeVidInput}
              />
            </>
          )}
          {state.showVideoArea && (
            <Box
              width="medium"
              round={"xsmall"}
              background="accent-1"
              border={{
                color: "accent-1",
                size: "large",
                style: "solid",
                side: "all",
              }}
              margin={{ vertical: "medium" }}
            >
              <Stack anchor="center" fill guidingChild="last">
                <Spinner size="large" />
                <Box
                  as={"video"}
                  autoPlay
                  playsInline
                  muted
                  round={"xsmall"}
                  elevation={"small"}
                  ref={refVideo}
                  width={{ max: "100%" }}
                  fill
                />
              </Stack>
            </Box>
          )}
          <Button
            primary
            label="This looks good"
            onClick={() => nextStep(null, null, state.tracks.audio)}
          />
        </>
      );
    }

    if (state.setupState === SetupState.WELCOME) {
      return (
        <>
          <Heading level={3} margin="none">
            <i>A warm welcome!</i>
          </Heading>
          <Paragraph>
            Looks like this is the first time you are joining a room. Let's make
            sure your audio and video are ready.
          </Paragraph>
          {!state.listedDevices && (
            <>
              <Paragraph>
                In order to setup your devices, we need your permission. When
                you are ready click the button below
              </Paragraph>
              <Button primary label="Give permission" onClick={getDeviceList} />
            </>
          )}
        </>
      );
    }
  };

  return (
    <Box pad="large">
      {state.permissionNeeded && (
        <Layer margin="medium" position="left">
          <Box pad="medium" direction="row">
            <Spinner margin={{ right: "small" }} />
            <Text>
              If you see a request, please allow it{" "}
              <LinkUp color="neutral-1" size="medium" />
            </Text>
          </Box>
        </Layer>
      )}
      {renderStep()}
    </Box>
  );
}

export default RoomSetup;

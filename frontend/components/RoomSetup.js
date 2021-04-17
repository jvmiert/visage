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

//todo: figure out what happens when resolution constraint is not available
//todo: handle permissions rejection
//todo: figure out if and how we can store device selection

function RoomSetup({ room, finishSetup }) {
  const refVideo = useRef(null);
  const refCanvas = useRef(null);
  const [state, setState] = useState({
    setupState: SetupState.WELCOME,
    devices: {},
    permissionNeeded: false,
    stream: null,
    audioContext: null,
    currentStream: null,
    selectedVideoInput: "",
    selectedAudioInput: "",
    listedDevices: false,
    gotPermissionsVid: false,
    gotPermissionsAud: false,
    showVideoArea: false,
    showMicArea: false,
  });

  const nextStep = (stream) => {
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
    }
    if (state.setupState === SetupState.VIDEO) {
      setState((prev) => ({
        ...prev,
        ...{
          setupState: SetupState.AUDIO,
        },
      }));
    }
    if (state.setupState === SetupState.AUDIO) {
      let audio = state.selectedAudioInput;
      let video = state.selectedVideoInput;
      if (state.selectedAudioInput == "") {
        audio = state.devices.audio[0].id;
      }
      if (state.selectedVideoInput == "") {
        video = state.devices.video[0].id;
      }
      finishSetup(audio, video);
    }
  };

  const getDeviceList = () => {
    setState((prev) => ({
      ...prev,
      ...{
        permissionNeeded: true,
      },
    }));
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: true,
      })
      .then((stream) => {
        let gotPermissions = {};
        stream.getTracks().forEach((track) => {
          const gotKey =
            track.kind === "video" ? "gotPermissionsVid" : "gotPermissionsAud";
          if (!gotPermissions[gotKey]) {
            gotPermissions[gotKey] = {};
          }
          gotPermissions[gotKey][track.getSettings().deviceId] = true;
        });
        navigator.mediaDevices
          .enumerateDevices()
          .then(function (devices) {
            let audioList = [];
            let videoList = [];
            devices.forEach(function (device) {
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
              },
              ...gotPermissions,
            }));
            nextStep(stream);
          })
          .catch(function (err) {
            console.log("mediaDevices error:", err);
          });
      })
      .catch(function (err) {
        console.log("mediaDevices error:", err);
      });
  };

  const setupVideo = useCallback((selectedVideo, gotPermissionsVid = true) => {
    let constraint = {
      codec: "vp8",
      audio: false,
      video: {
        width: { ideal: 1920 },
        frameRate: {
          ideal: 30,
          max: 60,
        },
      },
    };

    let permissionCheck = !gotPermissionsVid;

    if (selectedVideo) {
      constraint.video["deviceId"] = { exact: selectedVideo };
      permissionCheck = !gotPermissionsVid[selectedVideo];
    }

    if (permissionCheck) {
      setState((prev) => ({
        ...prev,
        ...{
          permissionNeeded: true,
        },
      }));
    } else {
      setState((prev) => ({
        ...prev,
        ...{
          showVideoArea: true,
        },
      }));
    }

    navigator.mediaDevices
      .getUserMedia(constraint)
      .then((stream) => {
        setState((prev) => {
          let newGotPermissionsVid = { gotPermissionsVid: true };

          if (selectedVideo) {
            newGotPermissionsVid = {
              gotPermissionsVid: {
                ...prev.gotPermissionsVid,
                ...{ [selectedVideo]: true },
              },
            };
          }
          return {
            ...prev,
            ...{
              stream,
              permissionNeeded: false,
              ...newGotPermissionsVid,
            },
          };
        });
      })
      .catch(function (err) {
        console.log("get video error:", err);
      });
  }, []);

  const setupAudio = useCallback(
    (canvas, deviceId, streamState, contextState, permissionState = {}) => {
      console.log("start audio setup...");
      let constraint = { audio: true };

      if (deviceId) {
        constraint = { audio: { deviceId: { exact: deviceId } } };
      }
      if (streamState) {
        streamState.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (contextState) {
        contextState.close();
      }

      if (!permissionState[deviceId]) {
        setState((prev) => ({
          ...prev,
          ...{
            permissionNeeded: true,
          },
        }));
      }

      navigator.mediaDevices
        .getUserMedia(constraint)
        .then((stream) => {
          let audioContext = new AudioContext();
          let analyser = audioContext.createAnalyser();
          let microphone = audioContext.createMediaStreamSource(stream);
          let javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

          analyser.smoothingTimeConstant = 0.8;
          analyser.fftSize = 1024;

          microphone.connect(analyser);
          analyser.connect(javascriptNode);
          javascriptNode.connect(audioContext.destination);

          const canvasContext = canvas.current.getContext("2d");

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
          setState((prev) => ({
            ...prev,
            ...{
              showMicArea: true,
              gotPermissionsAud: false,
              currentStream: stream,
              audioContext: audioContext,
              permissionNeeded: false,
            },
          }));
        })
        .catch(function (err) {
          console.log("get audio error:", err);

          setState((prev) => ({
            ...prev,
            ...{
              permissionNeeded: false,
              selectedAudioInput: "",
            },
          }));
        });
    },
    []
  );

  useEffect(() => {
    if (state.setupState === SetupState.VIDEO) {
      if (state.devices.video.length === 1) {
        setupVideo();
      }
    }
  }, [state.setupState, setupVideo]);

  useEffect(() => {
    if (state.setupState === SetupState.AUDIO) {
      if (state.devices.audio.length === 1) {
        setupAudio(refCanvas);
      }
    }
  }, [state.setupState, setupAudio, refCanvas]);

  useEffect(() => {
    if (!refVideo.current) return;
    if (!state.stream) return;
    refVideo.current.srcObject = state.stream;
  }, [state.stream]);

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
      value: device.id,
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
                onChange={(event) => {
                  setState((prev) => {
                    return {
                      ...prev,
                      ...{
                        selectedAudioInput: event.target.value,
                      },
                    };
                  });
                  setupAudio(
                    refCanvas,
                    event.target.value,
                    state.currentStream,
                    state.audioContext,
                    state.gotPermissionsAud
                  );
                }}
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
          <Button primary label="I'm ready" onClick={nextStep} />
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
                onChange={(event) => {
                  if (refVideo.current) {
                    refVideo.current.srcObject = null;
                  }
                  setState((prev) => ({
                    ...prev,
                    ...{
                      selectedVideoInput: event.target.value,
                      showVideoArea: true,
                    },
                  }));
                  setupVideo(event.target.value, state.gotPermissionsVid);
                }}
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
            onClick={() => nextStep(state.stream)}
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
          <Box pad="medium">
            <Text>
              Please allow this request{" "}
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

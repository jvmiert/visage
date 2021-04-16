import { useEffect, useState, useRef } from "react";

import {
  Box,
  Heading,
  Text,
  Button,
  Layer,
  Spinner,
  Stack,
  RadioButtonGroup,
} from "grommet";
import { LinkUp, Webcam, Microphone } from "grommet-icons";

import VideoElement from "./VideoElement";

const SetupState = {
  WELCOME: "welcome",
  VIDEO: "video",
  AUDIO: "audio",
};

//todo: figure out what happens when resolution constraint is not available
//todo: handle permissions rejection

function RoomSetup({ room }) {
  const refVideo = useRef(null);
  const [state, setState] = useState({
    setupState: SetupState.WELCOME,
    devices: {},
    permissionNeeded: false,
    stream: null,
    selectedVideoInput: "",
    selectedAudioInput: "",
    gotPermissions: false,
  });

  useEffect(() => {
    //todo: store firstTime/devices options in localstorage
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
          //console.log(device);
        });
        setState((prev) => ({
          ...prev,
          ...{
            devices: {
              audio: audioList,
              video: videoList,
            },
          },
        }));
      })
      .catch(function (err) {
        console.log("mediaDevices error:", err);
      });
  }, [room]);

  useEffect(() => {
    if (state.setupState === SetupState.VIDEO) {
      if (state.devices.video.length === 1) {
        if (!state.gotPermissions) {
          setState((prev) => ({
            ...prev,
            ...{
              permissionNeeded: true,
            },
          }));
        }
        navigator.mediaDevices
          .getUserMedia({
            codec: "vp8",
            audio: false,
            video: {
              deviceId: { exact: state.selectedVideoInput },
              width: { ideal: 1920 },
              frameRate: {
                ideal: 30,
                max: 60,
              },
            },
          })
          .then((stream) => {
            setState((prev) => ({
              ...prev,
              ...{
                stream,
                permissionNeeded: false,
                gotPermissions: true,
              },
            }));
          });
      }
    }
  }, [state.setupState]);

  useEffect(() => {
    if (!refVideo.current) return;
    if (!state.stream) return;
    refVideo.current.srcObject = state.stream;
  }, [state.stream]);

  useEffect(() => {
    if (state.selectedVideoInput !== "") {
      //todo: check permission status with navigator.permissions.query({name:'camera'})
      if (!state.gotPermissions[state.selectedVideoInput]) {
        setState((prev) => ({
          ...prev,
          ...{
            permissionNeeded: true,
          },
        }));
      }
      navigator.mediaDevices
        .getUserMedia({
          codec: "vp8",
          audio: false,
          video: {
            deviceId: { exact: state.selectedVideoInput },
            width: { ideal: 1920 },
            frameRate: {
              ideal: 30,
              max: 60,
            },
          },
        })
        .then((stream) => {
          setState((prev) => ({
            ...prev,
            ...{
              stream,
              permissionNeeded: false,
              gotPermissions: {
                ...prev.gotPermissions,
                ...{ [state.selectedVideoInput]: true },
              },
            },
          }));
        });
    }
  }, [state.selectedVideoInput]);

  const nextStep = () => {
    if (state.setupState === SetupState.WELCOME) {
      setState((prev) => ({
        ...prev,
        ...{
          setupState: SetupState.VIDEO,
        },
      }));
    }
    if (state.setupState === SetupState.VIDEO) {
      //todo: save state.selectedVideoInput in localstorage
      setState((prev) => ({
        ...prev,
        ...{
          setupState: SetupState.AUDIO,
        },
      }));
    }
  };

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

  if (state.setupState === SetupState.AUDIO) {
    return (
      <Box pad="large">
        <Heading level={3} margin="none">
          <i>Mic check 1, 2, 3</i>
        </Heading>
        <Text>Making sure you can be heard.</Text>
        {state.devices.audio.length > 1 && (
          <>
            <Text margin={{ vertical: "medium" }}>
              It looks like you have more than 1 audio device. Select which one
              you want to use:
            </Text>
            <RadioButtonGroup
              margin={{ bottom: "medium" }}
              name="audioChoice"
              options={renderOptions("audio")}
              value={state.selectedAudioInput}
              onChange={(event) => {
                setState((prev) => ({
                  ...prev,
                  ...{
                    selectedAudioInput: event.target.value,
                  },
                }));
              }}
            />
          </>
        )}
        <Button primary label="Next" onClick={nextStep} />
      </Box>
    );
  }

  if (state.setupState === SetupState.VIDEO) {
    return (
      <Box pad="large">
        {state.permissionNeeded && (
          <Layer margin="medium" position="left">
            <Box pad="medium">
              <Text>
                Please accept this permission{" "}
                <LinkUp color="neutral-1" size="medium" />
              </Text>
            </Box>
          </Layer>
        )}
        <Heading level={3} margin="none">
          Checking your video
        </Heading>
        <Text>Making sure you look good.</Text>

        {state.devices.video.length > 1 && (
          <>
            <Text margin={{ vertical: "medium" }}>
              It looks like you have more than 1 video device. Select which one
              you want to use:
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
                  },
                }));
              }}
            />
          </>
        )}
        {state.stream && (
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
        <Button primary label="This looks good" onClick={nextStep} />
      </Box>
    );
  }

  if (state.setupState === SetupState.WELCOME) {
    return (
      <Box pad="large">
        <Heading level={3} margin="none">
          <i>A warm welcome!</i>
        </Heading>
        <Text
          margin={{
            vertical: "medium",
          }}
        >
          Looks like this is the first time you are joining a room. Let's make
          sure your audio and video are ready.
        </Text>
        <Button primary label="Next" onClick={nextStep} />
      </Box>
    );
  }

  return <p>Something went wrong...</p>;
}

export default RoomSetup;

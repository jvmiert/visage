import { useCallback } from "react";

import { useRouter } from "next/router";

import { useStore } from "../../lib/zustandProvider";

import { Trans } from "@lingui/macro";

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

export function PermissionSetup() {
  const addDevice = useStore(useCallback((state) => state.addDevice, []));
  const addTrack = useStore(useCallback((state) => state.addTrack, []));

  const set = useStore(useCallback((state) => state.set, []));

  const currentVideoStream = useStore(
    useCallback((state) => state.currentVideoStream, [])
  );

  const router = useRouter();

  const nextStep = () => {
    const { roomID } = router.query;
    router.push(`/${roomID}/setup/video`);
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
      //todo: show permission helper
    }
    navigator.mediaDevices
      .getUserMedia({
        video: vidConstrains,
        audio: audioConstrains,
      })
      .then((stream) => {
        let activeDevices = [];
        stream.getTracks().forEach((track) => {
          const deviceId = track.getSettings().deviceId;
          activeDevices.push(deviceId);
          addTrack(track.kind, { track, stream, label: track.label }, deviceId);

          track.kind === "audio" &&
            set((state) => {
              state.activeAudio = deviceId;
            });
          track.kind === "video" &&
            set((state) => {
              state.activeVideo = deviceId;
            });
        });
        navigator.mediaDevices
          .enumerateDevices()
          .then(function (devices) {
            devices.forEach(function (device) {
              const deviceInfo = {
                label: device.label,
                id: device.deviceId,
              };
              device.kind === "audioinput" && addDevice("audio", deviceInfo);
              device.kind === "videoinput" && addDevice("video", deviceInfo);
            });
            nextStep();
          })
          .catch(function (err) {
            console.log("mediaDevices error:", err);
          });
      })
      .catch(function (err) {
        console.log("mediaDevices error:", err);
      });
  };

  return (
    <div>
      <h1>
        <i>A warm welcome!</i>
      </h1>
      <p>
        <Trans>
          Looks like this is the first time you are joining a room. Let&apos;s
          make sure your audio and video are ready.
        </Trans>
      </p>
      {!currentVideoStream ? (
        <p>
          In order to setup your devices, we need your permission. When you are
          ready click the button below
        </p>
      ) : (
        <p>We got your permission. Please continue to the next step.</p>
      )}
      <button onClick={!currentVideoStream ? getDeviceList : nextStep}>
        {!currentVideoStream ? "Give permission" : "Continue"}
      </button>
    </div>
  );
}

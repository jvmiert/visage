import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
  videoContainer: {
    display: "flex",
  },
  videoChild: {
    maxWidth: "200px",
  },
  videoElement: {
    width: "100%",
  },
});

function Room() {
  const videoHost = useRef(null);
  const videoPart = useRef(null);
  const classes = useStyles();

  const { room } = useParams();

  const [state, setState] = useState({
    loading: true,
    showVideo: false,
    full: false,
    error: false,
    notExist: false,
    isHost: false,
    tracks: [],
  });

  const loadVideo = useCallback((offer, candidate, room) => {
    async function loadVideo() {
      navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: true,
        })
        .then(
          (stream) => {
            let pc = new RTCPeerConnection({
              iceServers: [
                {
                  urls: "stun:stun.l.google.com:19302",
                },
              ],
            });

            pc.ontrack = function (event) {
              if (event.track.kind === "audio") {
                return;
              }

              videoPart.current.srcObject = event.streams[0];

              event.streams[0].onremovetrack = ({ track }) => {
                /* @TODO: remove the track */
                console.log("removing: ", track);
              };
            };

            pc.oniceconnectionstatechange = (e) => {
              console.log("connection state change", pc.iceConnectionState);
            };

            pc.onicecandidate = (e) => {
              axios
                .post("/api/candidate", {
                  room,
                  candidate: JSON.stringify(e.candidate),
                })
                .catch((error) => {
                  console.log(error);
                });
            };

            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            pc.setRemoteDescription(offer);
            pc.createAnswer().then((d) => {
              axios
                .post("/api/answer", { room, answer: JSON.stringify(d) })
                .catch((error) => {
                  console.log(error);
                });
              pc.setLocalDescription(d).then(() =>
                pc.addIceCandidate(candidate)
              );
            });
            videoHost.current.srcObject = stream;
            setState((prevState) => ({
              ...prevState,
              ...{ loading: false },
            }));
          },
          (err) => console.log(err)
        );
    }
    loadVideo();
  }, []);

  useEffect(() => {
    axios
      .get(`/api/room/join/${room}`)
      .then((result) => {
        if (!result.data.roomInfo.Joinable) {
          setState((prevState) => ({
            ...prevState,
            ...{
              loading: false,
              full: true,
            },
          }));
          return;
        }
        setState((prevState) => ({
          ...prevState,
          ...{
            showVideo: true,
            isHost: result.data.roomInfo.IsHost,
          },
        }));
        loadVideo(
          JSON.parse(result.data.hostOffer),
          JSON.parse(result.data.hostCandidate),
          room
        );
      })
      .catch((error) => {
        let newState = {};
        error.response.status === 404 &&
          Object.assign(newState, { notExist: true });

        Object.assign(newState, { loading: false });
        setState((prevState) => ({ ...prevState, ...newState }));
      });
  }, [room, loadVideo]);

  return (
    <div>
      <p>{room}</p>
      {state.loading && <p>Loading...</p>}
      {(state.notExist || state.full) && (
        <p>
          Sorry, this room {state.notExist ? "does not exist." : "is full."}{" "}
          <Link to="/">Go Home</Link>
        </p>
      )}
      <p>Host:</p>
      <div className={classes.videoContainer}>
        {state.showVideo && (
          <div className={classes.videoChild}>
            <video
              className={classes.videoElement}
              ref={videoHost}
              autoPlay
              playsInline
              muted
            ></video>
          </div>
        )}
      </div>
      <p>Participant:</p>
      <div className={classes.videoContainer}>
        {state.showVideo && (
          <div className={classes.videoChild}>
            <video
              className={classes.videoElement}
              ref={videoPart}
              autoPlay
              playsInline
              muted
            ></video>
          </div>
        )}
      </div>
    </div>
  );
}

export default Room;

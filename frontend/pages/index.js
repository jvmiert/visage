import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";

import { Trans } from "@lingui/macro";

import { slugify } from "../helpers";

import Navigation from "../components/Navigation";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

export default function Home() {
  const router = useRouter();

  const [room, setRoom] = useState("");
  const [error, setError] = useState(false);

  const changeRoomName = (e) => {
    setRoom(slugify(e.target.value));
  };

  const removeTrailingDash = (text) => {
    return text.replace(/^-+/, "").replace(/-+$/, "");
  };

  const joinRoom = () => {
    const roomFixed = removeTrailingDash(room);

    if (roomFixed === "") {
      setError("Please fill in a room name");
      return;
    }

    axios
      .get(`/api/room/create/${roomFixed}`)
      .then((result) => {
        router.push(`/${result.data}`);
      })
      .catch((error) => {
        if (error.response.status === 400) {
          setError("Sorry this room is full");
          return;
        }
        setError("Sorry something went wrong");
      });
  };

  const joinRandom = () => {
    axios
      .post("/api/room/create")
      .then((result) => {
        router.push(`/${result.data.uid}`);
      })
      .catch(() => {
        setError("Sorry something went wrong");
      });
  };
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="text-center max-w-screen-lg mt-10 flex flex-col lg:text-left lg:flex-row lg:mx-auto px-5">
        <div className="w-full lg:w-7/12 py-4 px-5">
          <div className="mx-auto max-w-md">
            <p className="text-4xl font-bold mb-6 text-gray-900">
              <Trans>A place to see each other clearly</Trans>
            </p>
            <p className="text-lg">
              <Trans>
                We watch our movies in HD, we take our photos in HD, why not
                have our video conversations in HD?
              </Trans>
            </p>
            <div>
              <div className="flex flex-row items-center mt-6">
                <FontAwesomeIcon
                  className="text-gray-600 mr-4"
                  icon={faCheck}
                />
                <p>See each other in HD video quality</p>
              </div>
              <div className="flex flex-row items-center mt-2">
                <FontAwesomeIcon
                  className="text-gray-600 mr-4"
                  icon={faCheck}
                />
                <p>Available on all your devices</p>
              </div>
              <div className="flex flex-row items-center mt-2">
                <FontAwesomeIcon
                  className="text-gray-600 mr-4"
                  icon={faCheck}
                />
                <p>Talk with up to 4 people at the same time</p>
              </div>
              <div className="flex flex-row items-center mt-2">
                <FontAwesomeIcon
                  className="text-gray-600 mr-4"
                  icon={faCheck}
                />
                <p>Easy to use interface</p>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full sm:w-80 mx-auto my-10 lg:w-5/12 lg:my-4 p-8 rounded-xl shadow-lg text-center">
          <p className="text-lg font-bold">
            <Trans>Conversations happen in a room</Trans>
          </p>
          <p className="mt-4">
            <Trans>
              Try it out now by by joining a room. <i>No account needed</i>
            </Trans>
          </p>
          <input
            type="text"
            id="textinput-room"
            name="room"
            placeholder="room-name"
            onChange={changeRoomName}
            value={room}
            maxLength={32}
            className="mx-auto w-full mt-4 mb-4 block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
          <div className="w-full flex flex-row justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded shadow-sm"
              type="submit"
              onClick={joinRoom}
            >
              <Trans>Join</Trans>
            </button>
            <button
              className="bg-white hover:bg-gray-100 font-semibold py-2 px-4 border rounded shadow-sm"
              type="submit"
              onClick={joinRandom}
            >
              <Trans>Pick for me</Trans>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

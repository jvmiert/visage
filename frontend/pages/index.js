import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";

import { Trans } from "@lingui/macro";

import { slugify } from "../helpers";

import Navigation from "../components/Navigation";

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
      .get("/api/room/create")
      .then((result) => {
        router.push(`/${result.data}`);
      })
      .catch(() => {
        setError("Sorry something went wrong");
      });
  };
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="max-w-md mt-5 mx-auto text-center">
        <div className="w-full p-2">
          <p className="text-4xl font-bold mb-4 text-gray-900">
            <Trans>A place to see each other clearly</Trans>
          </p>
          <p className="text-lg">
            <Trans>
              We watch our movies in HD, we take our photos in HD, why not have
              our video conversations in HD?
            </Trans>
          </p>
        </div>
        <div className="w-full p-2 mt-10 text-center">
          <p>
            <Trans>
              Conversations happen in a room.
              <br />
              <i>Join a room now to start talking!</i>
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
            className="mx-auto w-3/4 mt-4 mb-4 block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
          <div className="flex flex-row justify-around">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              type="submit"
              onClick={joinRoom}
            >
              <Trans>Join</Trans>
            </button>
            <button
              className="bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 border border-gray-200 rounded shadow"
              type="submit"
              onClick={joinRandom}
            >
              Pick for me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

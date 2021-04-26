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
      <div className="max-w-screen-lg mt-10 flex flex-row mx-auto">
        <div className="w-8/12 py-4 px-40">
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
        <div className="w-4/12 my-4 p-8 rounded-xl shadow-lg text-center">
          <p className="text-lg font-semibold">
            <Trans>Conversations happen in a room.</Trans>
          </p>
          <p className="text-lg italic">
            <Trans>Join a room now to start talking!</Trans>
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

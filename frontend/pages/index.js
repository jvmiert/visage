import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import Link from "next/link";
import { Trans } from "@lingui/macro";

import { slugify } from "../helpers";

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
    <div>
      <div>
        <h1>Visage</h1>
        <p>
          <Trans>A place to communicate</Trans>
        </p>
      </div>
      <div>
        <Link href="/" locale={router.locale === "vi" ? "en" : "vi"}>
          <a>Switch to {router.locale === "vi" ? "en" : "vi"}</a>
        </Link>
        <div>
          <p>
            Conversations happen in a room.{" "}
            <i>Join a room now to start talking!</i>
          </p>
        </div>
        <div
          width="medium"
          margin="small"
          pad="large"
          elevation={"xsmall"}
          round={"small"}
        >
          <input
            type="text"
            id="textinput-room"
            name="room"
            placeholder="room-name"
            onChange={changeRoomName}
            value={room}
            maxLength={32}
          />
          <div
            tag="footer"
            margin={{ top: "medium" }}
            direction="row"
            justify="between"
          >
            <button type="submit" onClick={joinRoom}>
              Join{" "}
            </button>
            <button type="submit" onClick={joinRandom}>
              Pick for me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

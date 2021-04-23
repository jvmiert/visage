import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import Link from "next/link";
import { Heading, Text, Box, FormField, TextInput, Button } from "grommet";
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
    <Box
      margin={{
        horizontal: "large",
        top: "small",
        bottom: "none",
      }}
    >
      <Box>
        <Heading
          level={2}
          margin={{
            horizontal: "none",
            top: "none",
            bottom: "xsmall",
          }}
        >
          Visage
        </Heading>
        <Text margin={"none"}>
          <Trans>A place to communicate</Trans>
        </Text>
      </Box>
      <Box align="center">
        <Link href="/" locale={router.locale === "vi" ? "en" : "vi"}>
          <a>Switch to {router.locale === "vi" ? "en" : "vi"}</a>
        </Link>
        <Box
          width="large"
          pad={{
            horizontal: "none",
            vertical: "large",
          }}
        >
          <Text weight={200} size={"xxlarge"} textAlign="center">
            Conversations happen in a room.{" "}
            <i>Join a room now to start talking!</i>
          </Text>
        </Box>
        <Box
          width="medium"
          margin="small"
          pad="large"
          elevation={"xsmall"}
          round={"small"}
        >
          <FormField
            error={error}
            name="room"
            htmlFor="textinput-room"
            label="Room"
          >
            <TextInput
              id="textinput-room"
              name="room"
              placeholder="room-name"
              onChange={changeRoomName}
              value={room}
              maxLength={32}
            />
          </FormField>
          <Box
            tag="footer"
            margin={{ top: "medium" }}
            direction="row"
            justify="between"
          >
            <Button primary type="submit" label="Join" onClick={joinRoom} />
            <Button
              secondary
              type="submit"
              label="Pick for me"
              onClick={joinRandom}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

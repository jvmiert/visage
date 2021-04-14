import { useState } from "react";
import { Heading, Text, Box, FormField, TextInput, Button } from "grommet";

import { slugify } from "../helpers";

export default function Home() {
  const [room, setRoom] = useState("");

  const changeRoomName = (e) => {
    setRoom(slugify(e.target.value));
  };

  const removeTrailingDash = (text) => {
    return text.replace(/^-+/, "").replace(/-+$/, "");
  };

  const joinRoom = () => {
    setRoom((prev) => removeTrailingDash(prev));
  };

  const joinRandom = () => {
    setRoom((prev) => removeTrailingDash(prev));
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
        <Text margin={"none"}>A place to communicate</Text>
      </Box>
      <Box align="center">
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
          <FormField name="room" htmlFor="textinput-room" label="Room">
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

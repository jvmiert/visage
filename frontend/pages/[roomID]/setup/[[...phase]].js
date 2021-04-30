import { useRouter } from "next/router";
import { t, Trans } from "@lingui/macro";

import {
  PermissionSetup,
  VideoSetup,
  AudioSetup,
} from "../../../components/RoomSetup";

// <RoomSetup finishSetup={finishSetup} />

const SetupState = {
  WELCOME: { name: t`Give Permission`, order: 0 },
  VIDEO: { name: t`Check Video`, order: 1 },
  AUDIO: { name: t`Check Audio`, order: 2 },
};

export default function RoomSetupView() {
  const router = useRouter();

  const phase = router.query.phase ? router.query.phase[0] : "welcome";

  if (phase === "welcome") return <PermissionSetup />;
  if (phase === "video") return <VideoSetup />;
  if (phase === "audio") return <AudioSetup />;

  return (
    <p>
      <Trans>Oops, something went wrong.</Trans>
    </p>
  );
}

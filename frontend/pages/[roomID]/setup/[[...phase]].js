import { useRouter } from "next/router";
import { PermissionSetup, VideoSetup } from "../../../components/RoomSetup";

// <RoomSetup finishSetup={finishSetup} />

export default function RoomSetupView() {
  const router = useRouter();

  const phase = router.query.phase ? router.query.phase[0] : "welcome";

  if (phase === "welcome") return <PermissionSetup />;
  if (phase === "video") return <VideoSetup />;
}

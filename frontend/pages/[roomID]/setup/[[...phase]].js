import { useRouter } from "next/router";
import { t, Trans } from "@lingui/macro";

import {
  PermissionSetup,
  VideoSetup,
  AudioSetup,
} from "../../../components/RoomSetup";

const SetupState = {
  welcome: { name: t`Give Permission`, order: 0 },
  video: { name: t`Check Video`, order: 1 },
  audio: { name: t`Check Audio`, order: 2 },
};

export default function RoomSetupView() {
  const router = useRouter();

  const phase = router.query.phase ? router.query.phase[0] : "welcome";

  const renderStep = (phase) => {
    switch (phase) {
      case "welcome":
        return <PermissionSetup />;
      case "video":
        return <VideoSetup />;
      case "audio":
        return <AudioSetup />;
      default:
        return (
          <p>
            <Trans>Oops, something went wrong.</Trans>
          </p>
        );
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-t from-purple-50 to-white p-5">
      <div className="mx-auto max-w-lg px-6 py-8 bg-white border-0 shadow-md rounded-lg">
        {renderStep(phase)}
      </div>
    </div>
  );
}

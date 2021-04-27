import { useRouter } from "next/router";
import {
  vidConstrains,
  audioConstrains,
  RoomSetup,
} from "../../../components/RoomSetup";

export default function RoomSetupView() {
  const router = useRouter();

  return <div>{JSON.stringify(router.query)}</div>;
}

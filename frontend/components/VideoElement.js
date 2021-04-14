import { useEffect, useRef } from "react";

import { Box } from "grommet";

function VideoElement({ srcObject, ...props }) {
  const refVideo = useRef(null);

  useEffect(() => {
    if (!refVideo.current) return;
    refVideo.current.srcObject = srcObject;
  }, [srcObject]);

  return (
    <Box
      as={"video"}
      autoPlay
      playsInline
      muted
      round={"xsmall"}
      elevation={"small"}
      ref={refVideo}
      {...props}
      width={{ max: "100%" }}
    />
  );
}

export default VideoElement;

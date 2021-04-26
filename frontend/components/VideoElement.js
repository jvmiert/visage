import { useEffect, useRef } from "react";

function VideoElement({ srcObject, ...props }) {
  const refVideo = useRef(null);

  useEffect(() => {
    if (!refVideo.current) return;
    refVideo.current.srcObject = srcObject;
  }, [srcObject]);

  return <video autoPlay playsInline muted ref={refVideo} {...props} />;
}

export default VideoElement;

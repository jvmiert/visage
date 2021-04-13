import React, { useEffect, useRef } from "react";

function VideoElement({ srcObject, ...props }) {
	const refVideo = useRef(null);

	useEffect(() => {
		if (!refVideo.current) return;
		refVideo.current.srcObject = srcObject;
	}, [srcObject]);

	return <video ref={refVideo} {...props} />;
}

export default VideoElement;

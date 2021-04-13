import React from "react";

import { Box, Heading } from "grommet";

function Main() {
	return (
		<Box
			tag="header"
			direction="row"
			align="center"
			justify="between"
			background="brand"
			pad={{ left: "small", right: "small", vertical: "small" }}
			elevation="medium"
			style={{ zIndex: "1" }}
		>
			<Heading margin="none">Welcome</Heading>
		</Box>
	);
}

export default Main;

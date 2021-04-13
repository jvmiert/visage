import React from "react";
import ReactDOM from "react-dom";
import "./fonts.css";
import { Grommet, grommet } from "grommet";
import { deepMerge } from "grommet/utils";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

const theme = deepMerge(grommet, {
	global: {
		colors: {
			brand: "#228BE6",
		},
		font: {
			family: "Mulish",
			size: "18px",
			height: "20px",
		},
	},
});

ReactDOM.render(
	<React.StrictMode>
		<Grommet theme={theme}>
			<App />
		</Grommet>
	</React.StrictMode>,
	document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

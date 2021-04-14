import "normalize.css";
import App from "next/app";
import "../styles/fonts.css";
import { Grommet, grommet as grommetTheme } from "grommet";
import { deepMerge } from "grommet/utils";

const theme = deepMerge(grommetTheme, {
  global: {
    colors: {
      //brand: "#228BE6",
    },
    font: {
      family: "Mulish",
      size: "18px",
      height: "20px",
    },
  },
});

export default class MyApp extends App {
  render() {
    const { Component, pageProps } = this.props;
    return (
      <Grommet theme={theme}>
        <Component {...pageProps} />
      </Grommet>
    );
  }
}

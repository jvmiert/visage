import { useEffect, useRef } from "react";

import "../styles/globals.css";
import "../styles/fonts.css";
import App from "next/app";

import { useCreateStore, Provider } from "../lib/store";
import SignalHOC from "../components/SignalHOC";

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { en as enPlural, vi as viPlural } from "make-plural/plurals";

import { messages as enTranslation } from "../locales/en/translation";
import { messages as viTranslation } from "../locales/vi/translation";

import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css"; // Import the CSS

config.autoAddCss = false; // Tell Font Awesome to skip adding the CSS automatically since it's being imported above

i18n.loadLocaleData("en", { plurals: enPlural });
i18n.loadLocaleData("vi", { plurals: viPlural });

i18n.load("en", enTranslation);
i18n.load("vi", viTranslation);

export default function MyApp({ Component, pageProps, router }) {
  const createStore = useCreateStore(pageProps.initialZustandState);
  const firstRender = useRef(true);

  if (firstRender.current) {
    i18n.activate(router.locale);
    firstRender.current = false;
  }
  useEffect(() => {
    i18n.activate(router.locale);
  }, [router.locale]);

  if (firstRender.current) return <div />;

  return (
    <Provider createStore={createStore}>
      <I18nProvider i18n={i18n}>
        <SignalHOC>
          <Component {...pageProps} />
        </SignalHOC>
      </I18nProvider>
    </Provider>
  );
}

MyApp.getInitialProps = async (appContext) => {
  const appProps = await App.getInitialProps(appContext);

  const { router, ctx } = appContext;
  const isServer = !!ctx.req;

  if (isServer) {
    i18n.activate(router.locale);
  }

  return { ...appProps };
};

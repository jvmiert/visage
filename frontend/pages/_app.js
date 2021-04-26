import App from "next/app";
import "../styles/fonts.css";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { en as enPlural, vi as viPlural } from "make-plural/plurals";

i18n.loadLocaleData("en", { plurals: enPlural });
i18n.loadLocaleData("vi", { plurals: viPlural });

let initialLoad = false;

export default function MyApp({ Component, pageProps, router, messages }) {
  if (!initialLoad) {
    i18n.load(router.locale, messages);
    i18n.activate(router.locale);
    initialLoad = true;
  }

  return (
    <I18nProvider i18n={i18n}>
      <Component {...pageProps} />
    </I18nProvider>
  );
}

MyApp.getInitialProps = async (appContext) => {
  const appProps = await App.getInitialProps(appContext);

  const initialLocale = appContext.router.locale;

  const { messages } = await import(`../locales/${initialLocale}/translation`);

  i18n.load(initialLocale, messages);
  i18n.activate(initialLocale);

  return { ...appProps, ...{ messages } };
};

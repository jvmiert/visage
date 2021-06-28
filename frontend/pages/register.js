import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { ErrorMessage } from "@hookform/error-message";
import axios from "axios";

import { useRouter } from "next/router";

import { Trans } from "@lingui/macro";

import Navigation from "../components/Navigation";
import StyledLink from "../components/StyledLink";

export default function Register() {
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({ criteriaMode: "all", shouldUnregister: true });
  const [useEmail, setUseEmail] = useState(true);

  const router = useRouter();

  const emailField = useRef(null);
  const emailRegister = register("email", {
    validate: {
      // eslint-disable-next-line react/display-name
      conditionalRequired: (v) =>
        getValues("phone") !== "" ||
        v.length > 0 || <Trans>Please enter an email address</Trans>,
    },
  });

  const phoneField = useRef(null);
  const phoneRegister = register("phone", {
    validate: {
      // eslint-disable-next-line react/display-name
      conditionalRequired: (v) =>
        getValues("email") !== "" ||
        v.length > 0 || <Trans>Please enter a phone number</Trans>,
    },
  });

  useEffect(() => {
    let hash = router.asPath.match(/#([a-z0-9]+)/gi);
    hash ? setUseEmail(false) : setUseEmail(true);
  }, [router.asPath]);

  useEffect(() => {
    if (emailField.current) {
      emailField.current.value = "";
      emailField.current.focus();
      setValue("phone", "");
      setValue("email", "");
    }
    if (phoneField.current) {
      phoneField.current.value = "";
      phoneField.current.focus();
      setValue("email", "");
      setValue("phone", "");
    }
  }, [useEmail, setValue]);

  const submitData = (data) => {
    let postData = { ...data };
    if (useEmail) {
      delete postData.phone;
    } else {
      delete postData.email;
    }
    axios
      .post("/api/user", { ...postData })
      .then((result) => {
        console.log("success:", result.data);
      })
      .catch((error) => {
        console.log("error: ", error.response.data);
      });
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="flex max-w-screen-lg mx-auto mt-12 mb-6">
        <div className="flex-1"></div>
        <div className="flex-1 shadow-xl sm:rounded-md">
          <div className="px-16 py-10 bg-white">
            <h3 className="text-xl font-black mb-8">
              <Trans>Create your account</Trans>
            </h3>
            <form action="/register" method="POST">
              <div className="space-y-10">
                {useEmail ? (
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-bold text-gray-700"
                    >
                      <Trans>Email</Trans>
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      autoComplete="email"
                      className="mt-2 mx-auto w-full block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      ref={(e) => {
                        emailRegister.ref(e);
                        emailField.current = e;
                      }}
                      onChange={emailRegister.onChange}
                      onBlur={emailRegister.onBlur}
                    />
                    <p className="pt-1 text-red-500">
                      <ErrorMessage errors={errors} name="email" />
                    </p>
                    <p className="pt-2 italic">
                      <Trans>
                        Rather use your phone number?{" "}
                        <StyledLink href="/register#usephone">
                          Click here to switch
                        </StyledLink>
                      </Trans>
                    </p>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-bold text-gray-700"
                    >
                      <Trans>Phone</Trans>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      autoComplete="tel"
                      className="mt-2 mx-auto w-full block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      ref={(e) => {
                        phoneRegister.ref(e);
                        phoneField.current = e;
                      }}
                      onChange={phoneRegister.onChange}
                      onBlur={phoneRegister.onBlur}
                    />
                    <p className="pt-1 text-red-500">
                      <ErrorMessage errors={errors} name="phone" />
                    </p>
                    <p className="pt-2 italic">
                      <Trans>
                        Rather use your email?{" "}
                        <StyledLink href="/register">
                          Click here to switch
                        </StyledLink>
                      </Trans>
                    </p>
                  </div>
                )}
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-bold text-gray-700"
                  >
                    <Trans>Full name</Trans>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    id="fullName"
                    autoComplete="name"
                    className="mt-2 mx-auto w-full block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    {...register("fullName", {
                      required: <Trans>Please enter your name</Trans>,
                    })}
                  />
                  <p className="pt-1 text-red-500">
                    <ErrorMessage errors={errors} name="fullName" />
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-bold text-gray-700"
                  >
                    <Trans>Password</Trans>
                  </label>
                  <input
                    type="password"
                    name="password"
                    id="password"
                    autoComplete="new-password"
                    className="mt-2 mx-auto w-full block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    {...register("password", {
                      required: <Trans>Please enter your password</Trans>,
                      minLength: {
                        value: 8,
                        message: (
                          <Trans>
                            Your password should be at least 8 characters
                          </Trans>
                        ),
                      },
                    })}
                  />
                  <p className="pt-1 text-red-500">
                    <ErrorMessage errors={errors} name="password" />
                  </p>
                </div>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 w-full rounded shadow-sm"
                  type="submit"
                  onClick={handleSubmit(submitData)}
                >
                  <Trans>Create Account</Trans>
                </button>
              </div>
            </form>
            <p className="pt-8">
              <Trans>
                If you already have an account,{" "}
                <StyledLink href="/login">click here to log in</StyledLink>
              </Trans>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

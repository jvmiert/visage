import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { ErrorMessage } from "@hookform/error-message";
import axios from "axios";

import { useRouter } from "next/router";

import { Trans } from "@lingui/macro";

import Navigation from "../components/Navigation";
import StyledLink from "../components/StyledLink";

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ criteriaMode: "all" });
  const [useEmail, setUseEmail] = useState(true);

  const router = useRouter();

  useEffect(() => {
    let hash = router.asPath.match(/#([a-z0-9]+)/gi);
    hash ? setUseEmail(false) : setUseEmail(true);
  }, [router.asPath]);

  const submitData = (data) => {
    axios
      .post("/api/login", { ...data })
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
              <Trans>Log in</Trans>
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
                      type="text"
                      name="email"
                      id="email"
                      autoComplete="email"
                      className="mt-2 mx-auto w-full block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      {...register("email", {
                        required: <Trans>Please enter an email address</Trans>,
                      })}
                    />
                    <p className="pt-1 text-red-500">
                      <ErrorMessage errors={errors} name="email" />
                    </p>
                    <p className="pt-2 italic">
                      <Trans>
                        Made your account with a phone number?{" "}
                        <StyledLink href="/login#phone">
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
                      type="text"
                      name="phone"
                      id="phone"
                      autoComplete="tel"
                      className="mt-2 mx-auto w-full block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      {...register("phone", {
                        required: <Trans>Please enter a phone number</Trans>,
                      })}
                    />
                    <p className="pt-1 text-red-500">
                      <ErrorMessage errors={errors} name="phone" />
                    </p>
                    <p className="pt-2 italic">
                      <Trans>
                        Rather use your email?{" "}
                        <StyledLink href="/login">
                          Click here to switch
                        </StyledLink>
                      </Trans>
                    </p>
                  </div>
                )}
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
                If you don't have an account yet,{" "}
                <StyledLink href="/register">
                  click here to register one
                </StyledLink>
              </Trans>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { ErrorMessage } from "@hookform/error-message";
import axios from "axios";

import { Trans } from "@lingui/macro";

import Navigation from "../components/Navigation";

export default function Register() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ criteriaMode: "all" });
  const [useEmail, setUseEmail] = useState(true);

  const submitData = (data) => {
    axios
      .post("/api/user", { ...data })
      .then((result) => {
        console.log("success:", result.data);
      })
      .catch((error) => {
        console.log("error: ", error.response.data);
      });
  };

  const togglePhone = () => {
    setUseEmail((prev) => !prev);
  };
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="flex max-w-screen-lg mx-auto mt-12">
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
                      Rather use your phone number?{" "}
                      <a
                        className="text-indigo-600 underline cursor-pointer"
                        onClick={togglePhone}
                      >
                        Click here to switch
                      </a>
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
                      Rather use your email?{" "}
                      <a
                        className="text-indigo-600 underline cursor-pointer"
                        onClick={togglePhone}
                      >
                        Click here to switch
                      </a>
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
                    <Trans> Password</Trans>
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
          </div>
        </div>
      </div>
    </div>
  );
}

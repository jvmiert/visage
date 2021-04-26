import { Fragment } from "react";

import Link from "next/link";

import { useRouter } from "next/router";

import { Menu, Transition } from "@headlessui/react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobeAsia } from "@fortawesome/free-solid-svg-icons";

export default function LangMenu() {
  const router = useRouter();
  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <Menu.Button>
            <FontAwesomeIcon className="text-gray-700" icon={faGlobeAsia} />
          </Menu.Button>
          <Transition
            show={open}
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-90"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-90"
          >
            <Menu.Items
              static
              className="absolute right-0 w-40 mt-2 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
            >
              <div className="">
                <Menu.Item>
                  {({ active }) => (
                    <div
                      className={`${
                        active ? "underline text-gray-900" : "text-gray-900"
                      } w-full group flex rounded-md items-center px-4 py-4 text-sm`}
                    >
                      <Link
                        href={router.route}
                        locale={router.locale === "vi" ? "en" : "vi"}
                      >
                        <a className="w-full">
                          {router.locale === "vi" ? "English" : "Tiếng Việt"}
                        </a>
                      </Link>
                    </div>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  );
}

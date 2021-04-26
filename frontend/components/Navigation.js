import LangMenu from "../components/LangMenu";

export default function Navigation() {
  return (
    <div className="relative bg-white">
      <div className="w-10/12 mx-auto px-4 sm:px-6">
        <div className="flex flex-row justify-start items-center flex-nowrap border-b-2 border-gray-100 py-3">
          <div className="flex justify-start flex-1">{/* logo */}</div>
          <div className="flex space-x-5">Visage</div>
          <div className="flex justify-end items-center flex-1 pr-6">
            <LangMenu />
          </div>
        </div>
      </div>
    </div>
  );
}

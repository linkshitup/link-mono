"use client";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import {
    FlaskIcon,
  FoldersIcon,
  LightbulbFilamentIcon,
  PackageIcon,
  QuestionMarkIcon,
} from "@phosphor-icons/react/dist/ssr";

const Topbar = () => {
  return (
    <div className="w-full sticky top-0 px-4 z-[99999] h-14 flex items-stretch ">
      <div className="flex h-full py-3 mr-12  ">
        <img src="/branding/logotype.svg" className="size-full" alt="" />
      </div>
      <div className="flex gap-6 py-2">
        <div className="border-2 border-black/15 gap-4   rounded-corners w-fit flex items-center px-4">
          <div className="font-primary flex items-center gap-2 text-lg">
            {" "}
            <FoldersIcon className="size-4" /> ronishrohan
          </div>
          <div className="h-full w-[1.5px] bg-stone-300 " ></div>
          <div className="font-primary flex items-center gap-2 text-lg">
            {" "}
            <PackageIcon className="size-4" /> Waffle
          </div>
          <div className="h-full w-[1.5px] bg-stone-300 " ></div><div className="font-primary flex items-center gap-2 text-lg">
            {" "}
            <FlaskIcon className="size-4" /> Development
          </div>
          
        </div>
      </div>
      <div className="ml-auto flex items-stretch gap-2 py-2">
        <div className="w-[300px] border-2 relative border-black/15 rounded-corners focus-within:bg-transparent! focus-within:border-black/40! font-primary group hover:bg-stone-100 hover:border-black/15">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-2 items-center text-base font-medium text-stone-500 duration-100 ease-in-out leading-2 group-focus-within:opacity-0 pointer-events-none  transition-all">
            <MagnifyingGlassIcon className="" />
            Search
          </div>
          <input
            type="text"
            className="size-full px-3 outline-none cursor-default"
          />
        </div>
        <button className="px-4 py-2 flex items-center hover:bg-stone-100 cursor-pointer justify-center font-primary border-2 border-black/15 font-medium rounded-corners text-stone-600 hover:text-stone-900">
          Documentation
        </button>
        <button className="aspect-square shrink-0 border-2 border-black/15  hover:border-black/20 text-stone-600 hover:text-stone-900  flex items-center justify-center hover:bg-stone-100  cursor-pointer rounded-corners">
          <LightbulbFilamentIcon weight="bold" />
        </button>
        <div className="aspect-square bg-white hover:bg-stone-200 cursor-pointer rounded-full overflow-hidden border-2 border-black/20 hover:brightness-90 flex items-center justify-center">
          <img
            src="https://i.pinimg.com/736x/fe/02/c7/fe02c76af4b7c4f9c94d727bb42d07d8.jpg"
            className="size-[calc(100%)] rounded-full object-cover"
            alt=""
          />
        </div>
      </div>
    </div>
  );
};

export default Topbar;

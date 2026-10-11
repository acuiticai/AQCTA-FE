import React from "react";
import notFound from "@/assets/img/404.svg";
import { Button } from "@/page-layouts/index";

const NotFound = () => {
  return (
    <div className="px-0 py-0 h-[80vh] flex flex-wrap content-center">
      <div className="block justify-items-center mx-auto items-center text-center">
        <img
          width={150}
          height={150}
          src={notFound}
          alt="404"
          className="mx-auto"
        />
        <h2 className="font-bold font-serif text-2xl mb-12 mt-8">
          Page is not found!
        </h2>
        <Button href="/" label="Back to Home" />
      </div>
    </div>
  );
};

export default NotFound;

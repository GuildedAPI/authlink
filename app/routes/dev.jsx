import { redirect } from "@remix-run/server-runtime";
import { Outlet, Link } from "@remix-run/react";

export async function loader({ request }) {
  if (new URL(request.url).pathname === "/dev") return redirect("/dev/docs");
  return null;
}

export default function Developers() {
  return (
    <div className="flex flex-wrap sm:flex-nowrap">
      <div
        className="shrink-0 mb-4 w-full sm:w-44 sm:mb-0 sm:mr-4 h-full sm:sticky top-[4.6rem]"
        id="sidebar"
      >
        <div className="bg-guilded-slate p-2 rounded border border-guilded-white/10">
          <div className="flex text-guilded-subtitle text-xs">
            <h3 className="font-bold">Menu</h3>
          </div>
          <ul className="text-guilded-link text-sm">
            <li>
              <Link to="/dev/apps">Your Apps</Link>
            </li>
            <li>
              <Link to="/dev/docs">Docs</Link>
            </li>
          </ul>
        </div>
      </div>
      <Outlet />
    </div>
  );
}

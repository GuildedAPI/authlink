import { useState } from "react";
import { Link } from "@remix-run/react";

export default function Index() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold">Authlink</h1>
      <p>
        This is a third-party site that implements the OAuth2 standard for{" "}
        <a
          href="https://www.guilded.gg"
          target="_blank"
          className="text-guilded-link"
        >
          Guilded
        </a>{" "}
        accounts.
      </p>
      <p>
        Authlink verifies account ownership for app developers and then allows
        them to access information through a set of limited scopes that the user
        explicitly authorizes.
      </p>
      <hr className="border-guilded-white/10 my-4" />
      <CollapseBox title="I'm a developer!">
        <p>
          Read up on the documentation{" "}
          <Link to="/dev/docs" className="text-guilded-link">
            here
          </Link>
          . Glad to have you on board!
        </p>
      </CollapseBox>
      <CollapseBox title="I'm not a developer" defaultOpen>
        <p>
          You won't have to worry about this site until an application or bot
          redirects you to it. If you're eager to see how it works anyway, you
          can go ahead and log in{" "}
          <Link to="/start" className="text-guilded-link">
            here
          </Link>
          .
        </p>
      </CollapseBox>
      <CollapseBox title="I think this website could be better">
        <p>
          You can get help with Authlink{" "}
          <a
            href="https://www.guilded.gg/authlink"
            className="text-guilded-link"
            target="_blank"
          >
            in its support server
          </a>
          . If you're suggesting a new feature, be sure to check out{" "}
          <a
            href="https://www.guilded.gg/authlink/groups/dnZ0AMjd/channels/a416c94d-acd5-4b1c-bf67-c677bf119bcd/list"
            className="text-guilded-link"
            target="_blank"
          >
            the todo list
          </a>{" "}
          and{" "}
          <a
            href="https://www.guilded.gg/authlink/groups/dnZ0AMjd/channels/6ecdf1c5-cd2a-46ce-9093-9286a42559ca/list"
            className="text-guilded-link"
            target="_blank"
          >
            idea board
          </a>{" "}
          first.
        </p>
      </CollapseBox>
    </div>
  );
}

const CollapseBox = ({ title, children, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-md bg-guilded-slate mt-2 py-4 border border-guilded-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 font-bold text-left text-xl flex"
      >
        <p className="my-auto">{title}</p>
        <i
          className={`ci-chevron_down ${
            open ? "rotate-180" : ""
          } transition ml-auto my-auto text-3xl`}
        />
      </button>
      {open && <div className="px-6">{children}</div>}
    </div>
  );
};

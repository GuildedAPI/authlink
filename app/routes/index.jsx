import { Link } from "@remix-run/react";

export default function Index() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Guilded Authlink</h1>
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
      <h2 className="text-2xl font-bold mt-4" id="how-it-works">
        How it works
      </h2>
      <p>
        This site does the heavy lifting of verifying Guilded account ownership
        and then allows developers to access information through a set of
        limited scopes that the user explicitly authorizes.
      </p>
      <h2 className="text-2xl font-bold mt-4" id="developers">
        I'm a developer!
      </h2>
      <p>
        Read up on the documentation{" "}
        <Link to="/dev/docs" className="text-guilded-link">
          here
        </Link>
        .
      </p>
      <h2 className="text-2xl font-bold mt-4" id="users">
        I'm not a developer :(
      </h2>
      <p>
        You probably won't have to worry about this site until an application
        redirects you to it. If you're eager to see how it works anyway, you can
        go ahead and link your account to your browser session{" "}
        <Link to="/start" className="text-guilded-link">
          here
        </Link>
        .
      </p>
      <h2 className="text-2xl font-bold mt-4" id="users">
        I think this website could be better!
      </h2>
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
    </div>
  );
}

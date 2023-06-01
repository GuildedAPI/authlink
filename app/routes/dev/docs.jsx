import { Link } from "@remix-run/react";
import { InlineCode } from "~/common/components";

function AnchoredHeader(props) {
  return (
    <div className="group flex mt-4" id={props.id}>
      <h1 className={`font-bold text-${props.size}`}>{props.children}</h1>
      <Link
        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
        to={`#${props.id}`}
      >
        <i className={`ci-link_02 text-${props.size}`} />
      </Link>
    </div>
  );
}

function Endpoint(props) {
  return (
    <div className="mt-6 mb-2">
      <AnchoredHeader
        size="xl"
        id={props.name.replace(/ /g, "-").toLowerCase()}
      >
        {props.name}
      </AnchoredHeader>
      <p className="text-lg">
        <code className="uppercase font-bold mr-2 bg-guilded-gilded text-guilded-black rounded px-2 py-0.5">
          {props.method}
        </code>
        <code>{props.children}</code>
      </p>
    </div>
  );
}

const preStyle =
  "bg-guilded-slate rounded p-2 overflow-auto break-all whitespace-pre-wrap";
const tableStyle = "mt-2 bg-guilded-slate text-sm";
const tdStyle = "px-2 py-1 border border-white/10";
const trtdStyle = tdStyle + " font-bold bg-guilded-black";

export const meta = () => {
  return {
    title: "API Docs - Guilded Authlink",
  };
};

export default function Docs() {
  return (
    <div>
      <h1 className="font-bold text-2xl">API Docs</h1>
      <p>
        This is the documentation for the Guilded Authlink API. You can read
        about what this website does{" "}
        <Link to="/" className="text-guilded-link">
          here
        </Link>
        .
      </p>
      <AnchoredHeader size="xl" id="before-we-start">
        Before We Start
      </AnchoredHeader>
      <p>
        Authlink is compliant with{" "}
        <a
          href="https://datatracker.ietf.org/doc/html/rfc6749"
          className="text-guilded-link"
          target="_blank"
        >
          RFC 6749
        </a>
        . If you have any questions about how to design your client that aren't
        covered on this page, refer there!
      </p>
      <AnchoredHeader size="xl" id="base-url">
        Base URL
      </AnchoredHeader>
      <pre className={preStyle}>https://authlink.app/api/v1</pre>
      <AnchoredHeader size="2xl" id="create-an-application">
        Create an Application
      </AnchoredHeader>
      <ol className="list-decimal ml-4">
        <li>
          Go to{" "}
          <Link to="/dev/apps" className="text-guilded-link">
            your applications page
          </Link>
          .
        </li>
        <li>Click the "New Application" button.</li>
        <li>
          Follow the instructions on that page to link your Guilded bot to an
          Authlink application.
        </li>
      </ol>
      <AnchoredHeader size="2xl" id="authorization">
        Authorization
      </AnchoredHeader>
      <p>
        Each application has its own authorization URL to which it must send
        users in order to begin the OAuth flow. You can generate one of these
        with your desired scopes on{" "}
        <Link to="/dev/apps" className="text-guilded-link">
          your application's page
        </Link>
        .
      </p>
      <AnchoredHeader size="xl" id="the-basic-flow">
        The Basic Flow
      </AnchoredHeader>
      <ol className="list-decimal ml-4">
        <li>
          User visits your application's website and clicks a "Log in with
          Guilded" button (or similar)
        </li>
        <li>
          User is redirected to{" "}
          <Link to="#authorization-urls">your authorization page</Link> on
          Guilded Authlink
        </li>
        <ul className="list-disc ml-4">
          <li>
            If the user's browser session is not already verified, they will be
            taken through the{" "}
            <Link to="/start" className="text-guilded-link">
              start flow
            </Link>{" "}
            here
          </li>
        </ul>
        <li>User allows or denies access to the scopes you selected</li>
        <li>
          User is taken back to your <InlineCode>redirect_uri</InlineCode> with
          a <InlineCode>code</InlineCode> in the proceeding GET request's query
          string made by the user's browser
        </li>
        <li>
          Your application exchanges code for an access token, which it can use
          to call{" "}
          <Link to="#endpoints" className="text-guilded-link">
            API endpoints
          </Link>
        </li>
      </ol>
      <p>This is the only flow type that Authlink offers support for.</p>
      <AnchoredHeader size="xl" id="scopes">
        Scopes
      </AnchoredHeader>
      <table className={tableStyle}>
        <thead>
          <tr>
            <td className={trtdStyle}>Name</td>
            <td className={trtdStyle}>Allows access to</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdStyle}>identify</td>
            <td className={tdStyle}>
              <Link to="#get-current-user" className="text-guilded-link">
                /users/@me
              </Link>
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>servers</td>
            <td className={tdStyle}>
              <Link
                to="#get-current-user-servers"
                className="text-guilded-link"
              >
                /users/@me/servers
              </Link>
              {" & "}
              <Link to="#get-server" className="text-guilded-link">
                /servers/{"{server.id}"}
              </Link>
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>servers.members.read</td>
            <td className={tdStyle}>
              <Link
                to="#get-current-user-server-member"
                className="text-guilded-link"
              >
                /users/@me/servers/{"{server.id}"}/member
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
      <AnchoredHeader size="xl" id="authorization-url-structure">
        Authorization URL Structure
      </AnchoredHeader>
      <pre className={preStyle}>
        https://authlink.app/auth?client_id=5f61fed3-e4b4-4d3c-bfa8-29514b4d675c&scope=identify+servers&redirect_uri=https%3A%2F%2Fdemo.authlink.app%2Fme&prompt=consent&state=Um9yCthzQtjuIv6Cx48QS6NMXvdq2soQ
      </pre>
      <ul className="list-disc ml-4">
        <li>
          <InlineCode>client_id</InlineCode> - your application's client ID.
          This is the same as the linked bot ID that you created the application
          with.
        </li>
        <li>
          <InlineCode>scope</InlineCode> - a list of url-encoded-space-separated
          scopes that you want to authorize your application for.
        </li>
        <li>
          <InlineCode>redirect_uri</InlineCode> - the URI that your users should
          be redirected to after authorizing your application. This must be a
          valid entry under "Redirect URIs" on your application's page.
        </li>
        <li>
          <InlineCode>state</InlineCode> - a unique, user-specific, unguessable
          string that Authlink should return to your application upon
          authorization. If it does not match what you sent, you should reject
          the authorization.{" "}
          <a
            href="https://auth0.com/docs/secure/attack-protection/state-parameters"
            target="_blank"
            className="text-guilded-link"
          >
            Read more about this parameter.
          </a>
        </li>
        <li>
          <InlineCode>prompt</InlineCode> - If this is{" "}
          <InlineCode>consent</InlineCode> (default), reapproval will be
          prompted even if the user has already authorized your application with
          the selected scopes. If this is <InlineCode>none</InlineCode>, the
          authorization screen will be skipped automatically when these criteria
          are met.
        </li>
      </ul>
      <AnchoredHeader size="lg" id="redirect-uri">
        Redirect URI
      </AnchoredHeader>
      <pre className={preStyle}>
        https://demo.authlink.app/me?code=M3oo84JqCYFcToYxjzWKVHEVnmd3Rfol&state=Um9yCthzQtjuIv6Cx48QS6NMXvdq2soQ
      </pre>
      <p>
        At this point, you should verify the <InlineCode>state</InlineCode>{" "}
        param mentioned above, if you included it. You can now exchange{" "}
        <InlineCode>code</InlineCode> for the user's access token:
      </p>
      <Endpoint method="post" name="Exchange Code">
        /token
      </Endpoint>
      <p>
        Exchange a code for an access token for use with the rest of the API or
        refresh an access token using a refresh token. Codes have a TTL of 15
        seconds, so act fast! Refresh tokens do not expire, but they will be
        invalidated if the user deauthorizes your application.
      </p>
      <p className="font-bold mt-4">
        Form Data Parameters (application/x-www-form-urlencoded)
      </p>
      <table className={tableStyle}>
        <thead>
          <tr>
            <td className={trtdStyle}>Field</td>
            <td className={trtdStyle}>Type</td>
            <td className={trtdStyle}>Description</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdStyle}>client_id</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>your applicaton's client id</td>
          </tr>
          <tr>
            <td className={tdStyle}>client_secret</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>your application's client secret</td>
          </tr>
          <tr>
            <td className={tdStyle}>grant_type</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              must be <InlineCode>authorization_code</InlineCode> or{" "}
              <InlineCode>refresh_token</InlineCode>
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>code?</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              the <InlineCode>code</InlineCode> query string argument passed
              through the redirect request. either this or{" "}
              <InlineCode>refresh_token</InlineCode> is required depending on{" "}
              <InlineCode>grant_type</InlineCode>
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>refresh_token?</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              the user's refresh token. either this or{" "}
              <InlineCode>code</InlineCode> is required depending on{" "}
              <InlineCode>grant_type</InlineCode>
            </td>
          </tr>
        </tbody>
      </table>
      <AnchoredHeader size="md" id="access-token-response">
        Access Token Response
      </AnchoredHeader>
      <table className={tableStyle}>
        <thead>
          <tr>
            <td className={trtdStyle}>Property</td>
            <td className={trtdStyle}>Type</td>
            <td className={trtdStyle}>Description</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdStyle}>access_token</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>the user's access token</td>
          </tr>
          <tr>
            <td className={tdStyle}>token_type</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              always <InlineCode>Bearer</InlineCode>
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>expires_in</td>
            <td className={tdStyle}>integer</td>
            <td className={tdStyle}>
              seconds until <InlineCode>access_token</InlineCode> expires
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>refresh_token</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              the user's refresh token, which can be used to{" "}
              <Link to="#exchange-code">refresh the access token</Link> when it
              expires
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>scope</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              the scopes your application was authorized for, space-separated
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        And of course, if your application ever decides that it doesn't want the
        access token to be valid anymore:
      </p>
      <Endpoint method="post" name="Revoke Token">
        /token/revoke
      </Endpoint>
      <p>
        Revoke a token, immediately invalidating it and its associated
        access/refresh token depending on the type of token being revoked. See
        also:{" "}
        <a
          href="https://datatracker.ietf.org/doc/html/rfc7009"
          className="text-guilded-link"
          target="_blank"
        >
          RFC 7009
        </a>
        .
      </p>
      <p className="font-bold mt-4">
        Form Data Parameters (application/x-www-form-urlencoded)
      </p>
      <table className={tableStyle}>
        <thead>
          <tr>
            <td className={trtdStyle}>Field</td>
            <td className={trtdStyle}>Type</td>
            <td className={trtdStyle}>Description</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdStyle}>client_id</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>your applicaton's client id</td>
          </tr>
          <tr>
            <td className={tdStyle}>client_secret</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>your application's client secret</td>
          </tr>
          <tr>
            <td className={tdStyle}>token</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>the token to revoke</td>
          </tr>
          {/*
          <tr>
            <td className={tdStyle}>token_type_hint?</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              this parameter is ignored, but it may be provided
              per <a href='https://datatracker.ietf.org/doc/html/rfc7009#section-2.1' className='text-guilded-link' target='_blank'>RFC 7009</a>
            </td>
          </tr>
          */}
        </tbody>
      </table>
      <AnchoredHeader size="2xl" id="endpoints">
        Endpoints
      </AnchoredHeader>
      <p>
        <a
          href="https://www.youtube.com/watch?v=PGj4OX34ECY"
          target="_blank"
          className="text-guilded-link"
        >
          Fly, my pretties!
        </a>{" "}
        Now that you have your{" "}
        <Link to="#access-token-response" className="text-guilded-link">
          user's access token
        </Link>
        , you can begin making authorized requests with it. Make sure to include
        a proper authorization header:
      </p>
      <pre className={preStyle}>Authorization: Bearer ACCESS_TOKEN</pre>
      <Endpoint method="get" name="Get Current User">
        /users/@me
      </Endpoint>
      <p>
        Get the access token's representing user. Requires the{" "}
        <InlineCode>identify</InlineCode> scope.
      </p>
      <AnchoredHeader size="md" id="get-current-user-example">
        JSON Response Example
      </AnchoredHeader>
      <pre className={preStyle}>
        {JSON.stringify(
          {
            id: "EdVMVKR4",
            name: "shay",
            subdomain: "shayy",
            aliases: [
              {
                alias: "shay",
                discriminator: null,
                name: "shay",
                createdAt: "2021-03-03T20:59:27.797536+00:00",
                userId: "EdVMVKR4",
                gameId: 421074,
                socialLinkSource: null,
                additionalInfo: {},
                editedAt: "2021-03-03T20:59:27.797536+00:00",
                socialLinkHandle: null,
                playerInfo: null,
              },
            ],
            avatar:
              "https://s3-us-west-2.amazonaws.com/www.guilded.gg/UserAvatar/c2da767cf9795e7c73facc399159fefc-Large.png?w=450&h=450",
            banner:
              "https://s3-us-west-2.amazonaws.com/www.guilded.gg/UserBanner/acaa9d0f78dd8cdd93f3ce44d14c0260-Hero.png?w=1500&h=500",
            createdAt: "2020-07-27T14:07:28.336Z",
            userStatus: {
              content: null,
              customReactionId: 925765,
              customReaction: {
                id: 925765,
                name: "blobspider",
                png: "https://s3-us-west-2.amazonaws.com/www.guilded.gg/CustomReaction/b721e28333392c335fcff52eb27997fd-Full.webp?w=120&h=120",
                webp: "https://s3-us-west-2.amazonaws.com/www.guilded.gg/CustomReaction/b721e28333392c335fcff52eb27997fd-Full.webp?w=120&h=120",
                apng: null,
              },
            },
            moderationStatus: null,
            aboutInfo: {
              bio: "pfp: https://deviantart.com/zededge/art/Korra-Mass-Effect-FSRX-2-492156216",
              tagLine: "computer user",
            },
            lastOnline: "2022-04-19T17:02:55.499Z",
            userPresenceStatus: 2,
            userTransientStatus: null,
          },
          null,
          4
        )}
      </pre>
      <Endpoint method="get" name="Get Current User Servers">
        /users/@me/servers
      </Endpoint>
      <p>
        Get a list of partial servers for the access token's representing user.
        This will include private servers, which are indistinguishable from
        public servers. This endpoint cannot be paginated. Requires the{" "}
        <InlineCode>servers</InlineCode> scope.
      </p>
      <AnchoredHeader size="md" id="get-current-user-servers-example">
        JSON Response Example
      </AnchoredHeader>
      <pre className={preStyle}>
        {JSON.stringify(
          [
            {
              id: "wlVr3Ggl",
              name: "Guilded",
              subdomain: "Guilded-Official",
              profilePicture:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamAvatar/f3ca3496e7f2b6bfaeddfbb6526bdec7-Large.png?w=450&h=450",
              teamDashImage:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamBanner/e9a77c1048effb0d92d237bac30b563c-Hero.png?w=1500&h=500",
              gameIds: [
                "350074",
                "216000",
                "10300",
                "104200",
                "10800",
                "10100",
              ],
              memberCount: 22819,
            },
            {
              id: "4R5q39VR",
              name: "Guilded-API",
              subdomain: "guilded-api",
              profilePicture:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamAvatar/a66e23924a4bc49fbf9242a98d955a7c-Large.png?w=450&h=450",
              teamDashImage:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamBanner/62d94db23c910fa3a209b5edf2cf7387-Hero.png?w=1067&h=600",
              memberCount: 1989,
            },
            {
              id: "QR46qKZE",
              name: "Guilded API",
              subdomain: "API-Official",
              profilePicture:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamAvatar/04ff07e3a8f1f109c4885d25de8d913d-Large.png?w=450&h=450",
              teamDashImage:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamBanner/cb593892c7c1446c1b4747b0c6743e0e-Hero.png?w=1864&h=445",
              memberCount: 247,
            },
            {
              id: "NEaw5pGR",
              name: "Blob Emojis",
              subdomain: "blob-emoji",
              profilePicture:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamAvatar/8bcde8550493d0c68468d15f408511cb-Large.png?w=450&h=450",
              teamDashImage:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamBanner/f0cf92b4d0fbeb69221d47b202f2f2d8-Hero.png?w=1024&h=576",
              memberCount: 27,
            },
          ],
          null,
          4
        )}
      </pre>
      <p className="font-bold mt-4">
        Some Guilded limitations are in effect here:
      </p>
      <ul className="list-disc ml-4">
        <li>
          The <InlineCode>memberCount</InlineCode> property may be inaccurate by
          a considerable margin for larger servers.
        </li>
        <li>
          Permissions and owner status could not be included in this response.
          If you need this information, use{" "}
          <Link
            to="#get-current-user-server-member"
            className="text-guilded-link"
          >
            Get Current User Server Member
          </Link>
          .
        </li>
      </ul>
      <Endpoint method="get" name="Get Server">
        /servers/{"{server.id}"}
      </Endpoint>
      <p>
        Get a server that the access token's representing user is a member of.
        This is not available if the server is private. Requires the{" "}
        <InlineCode>servers</InlineCode> scope.
      </p>
      <AnchoredHeader size="md" id="get-server-response">
        JSON Response
      </AnchoredHeader>
      <table className={tableStyle}>
        <thead>
          <tr>
            <td className={trtdStyle}>Field</td>
            <td className={trtdStyle}>Type</td>
            <td className={trtdStyle}>Description</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdStyle}>id</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>The ID of the server.</td>
          </tr>
          <tr>
            <td className={tdStyle}>name</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>The name of the server.</td>
          </tr>
          <tr>
            <td className={tdStyle}>ownerId</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              The ID of the user that owns the server.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>type?</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              The type of server as set in its settings page.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>url</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              The URL slug of the server. There is a deprecated alternative to
              this property named <InlineCode>subdomain</InlineCode>.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>timezone?</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>The server's timezone.</td>
          </tr>
          <tr>
            <td className={tdStyle}>visibility</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              The server's visibility ("default" or "open-entry"). You should
              never receive a server with "private" visibility.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>avatar</td>
            <td className={tdStyle}>?string</td>
            <td className={tdStyle}>
              The CDN URL of the server's avatar image. There is a deprecated
              alternative to this property named{" "}
              <InlineCode>profilePicture</InlineCode>.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>banner</td>
            <td className={tdStyle}>?string</td>
            <td className={tdStyle}>
              The CDN URL of the server's banner image. There is a deprecated
              alternative to this property named{" "}
              <InlineCode>teamDashImage</InlineCode>.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>isRecruiting?</td>
            <td className={tdStyle}>boolean</td>
            <td className={tdStyle}>
              Whether the server is accepting new member applications.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>isVerified?</td>
            <td className={tdStyle}>boolean</td>
            <td className={tdStyle}>Whether the server is verified.</td>
          </tr>
          <tr>
            <td className={tdStyle}>isDiscoverable?</td>
            <td className={tdStyle}>boolean</td>
            <td className={tdStyle}>
              Whether the server is discoverable. This is different from{" "}
              <InlineCode>visibility</InlineCode>.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>followerCount?</td>
            <td className={tdStyle}>integer</td>
            <td className={tdStyle}>
              The number of followers that the server has.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>memberCount</td>
            <td className={tdStyle}>integer</td>
            <td className={tdStyle}>
              The number of members that the server has. A value of{" "}
              <InlineCode>0</InlineCode> indicates that Authlink could not get
              the value from Guilded.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>rolesById</td>
            <td className={tdStyle}>
              object (string:
              <Link to="#role-object" className="text-guilded-link">
                Role
              </Link>
              )
            </td>
            <td className={tdStyle}>The roles in the server.</td>
          </tr>
        </tbody>
      </table>
      <AnchoredHeader size="md" id="role-object">
        Role Object
      </AnchoredHeader>
      <table className={tableStyle}>
        <thead>
          <tr>
            <td className={trtdStyle}>Field</td>
            <td className={trtdStyle}>Type</td>
            <td className={trtdStyle}>Description</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdStyle}>id</td>
            <td className={tdStyle}>integer</td>
            <td className={tdStyle}>The ID of the role.</td>
          </tr>
          <tr>
            <td className={tdStyle}>name</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>The name of the role.</td>
          </tr>
          <tr>
            <td className={tdStyle}>color?</td>
            <td className={tdStyle}>?integer</td>
            <td className={tdStyle}>The role's primary color.</td>
          </tr>
          <tr>
            <td className={tdStyle}>color2?</td>
            <td className={tdStyle}>?integer</td>
            <td className={tdStyle}>
              The role's secondary color, for gradient roles.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>priority</td>
            <td className={tdStyle}>integer</td>
            <td className={tdStyle}>
              The priority of the role. Not to be confused with the displayed
              position of the role.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>createdAt</td>
            <td className={tdStyle}>string (ISO8601 timestamp)</td>
            <td className={tdStyle}>When the role was created.</td>
          </tr>
          <tr>
            <td className={tdStyle}>updatedAt?</td>
            <td className={tdStyle}>?string (ISO8601 timestamp)</td>
            <td className={tdStyle}>When the role was last updated.</td>
          </tr>
          <tr>
            <td className={tdStyle}>isBase?</td>
            <td className={tdStyle}>boolean</td>
            <td className={tdStyle}>
              Whether the role is the server's base member role.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>isMentionable?</td>
            <td className={tdStyle}>boolean</td>
            <td className={tdStyle}>
              Whether the role is mentionable by all members.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>isSelfAssignable?</td>
            <td className={tdStyle}>boolean</td>
            <td className={tdStyle}>
              Whether the role is self-assignable without the Manage Roles
              permission.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>isDisplayedSeparately?</td>
            <td className={tdStyle}>boolean</td>
            <td className={tdStyle}>
              Whether the role is displayed separately from other roles (or
              "hoisted").
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>serverId</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              The ID of the server that the role is in.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>permissions</td>
            <td className={tdStyle}>object (string:integer)</td>
            <td className={tdStyle}>The role's permissions.</td>
          </tr>
          <tr>
            <td className={tdStyle}>discordRoleId?</td>
            <td className={tdStyle}>string (snowflake)</td>
            <td className={tdStyle}>
              The ID of the Discord role that this role is synced to.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>discordSyncedAt?</td>
            <td className={tdStyle}>string (ISO8601 timestamp)</td>
            <td className={tdStyle}>
              When this role was last synced to Discord.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>bot?</td>
            <td className={tdStyle}>object</td>
            <td className={tdStyle}>
              Information about the bot that the role is for. Contains a{" "}
              <InlineCode>userId</InlineCode> key - the user ID of the bot.
            </td>
          </tr>
        </tbody>
      </table>
      <AnchoredHeader size="md" id="get-server-example">
        JSON Response Example
      </AnchoredHeader>
      <pre className={preStyle}>
        {JSON.stringify(
          {
            id: "wlVr3Ggl",
            name: "Guilded",
            url: "Guilded-Official",
            about:
              "The Official Guilded Team! For devs, friends, and fans alike!",
            timezone: "America/Los Angeles (PST/PDT)",
            type: "community",
            visibility: "open-entry",
            createdAt: "2018-10-05T19:25:13.449Z",
            ownerId: "R403kZxA",
            avatar:
              "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamAvatar/f3ca3496e7f2b6bfaeddfbb6526bdec7-Large.png?w=450&h=450",
            banner:
              "https://s3-us-west-2.amazonaws.com/www.guilded.gg/TeamBanner/fe3137f65c9f6d93658c8ed99b1a2ac8-Hero.png?w=1500&h=500",
            socialInfo: {
              twitch: "https://www.twitch.tv/teamguilded",
              twitter: "@teamguilded",
              youtube: "https://www.youtube.com/guildedgg",
              facebook: "Guilded.gg",
            },
            isRecruiting: true,
            isVerified: true,
            isDiscoverable: true,
            followerCount: 1878,
            gameIds: [350074, 216000, 10300, 104200, 10800, 10100],
            flairs: [{ id: 3 }, { id: 1, amount: 323 }, { id: 6 }],
            memberCount: 24965,
            rolesById: {
              590401: {
                id: 590401,
                name: "Member",
                color: 13750741,
                permissions: {
                  chat: 35,
                  docs: 2,
                  forms: 16,
                  lists: 2,
                  media: 2,
                  voice: 4163,
                  forums: 67,
                  streams: 192,
                  calendar: 2,
                  announcements: 2,
                },
                priority: -11,
                createdAt: "2018-10-05T19:25:16.216Z",
                updatedAt: "2022-07-02T19:52:15.795Z",
                isBase: true,
                isMentionable: true,
                isSelfAssignable: false,
                isDisplayedSeparately: true,
                serverId: "wlVr3Ggl",
              },
              591232: {
                id: 591232,
                name: "Guilded Staff",
                color: 10637544,
                permissions: {
                  xp: 1,
                  bots: 1,
                  chat: 503,
                  docs: 15,
                  forms: 18,
                  lists: 63,
                  media: 15,
                  voice: 8179,
                  forums: 123,
                  general: 64564,
                  streams: 243,
                  brackets: 3,
                  calendar: 31,
                  scheduling: 11,
                  matchmaking: 20,
                  recruitment: 55,
                  announcements: 7,
                  customization: 49,
                },
                priority: 17,
                color2: 3188367,
                createdAt: "2018-10-05T21:27:27.522Z",
                updatedAt: "2022-07-02T00:14:29.845Z",
                discordRoleId: "497837817569869824",
                discordSyncedAt: "2018-10-05T22:50:38.864Z",
                isMentionable: false,
                isSelfAssignable: false,
                isDisplayedSeparately: true,
                serverId: "wlVr3Ggl",
              },
              25746098: {
                id: 25746098,
                name: "Bot",
                color: 8296183,
                permissions: {
                  xp: 1,
                  bots: 1,
                  chat: 503,
                  docs: 15,
                  forms: 18,
                  lists: 63,
                  media: 15,
                  voice: 8179,
                  forums: 123,
                  general: 130100,
                  streams: 243,
                  brackets: 3,
                  calendar: 31,
                  scheduling: 11,
                  matchmaking: 20,
                  recruitment: 55,
                  announcements: 7,
                  customization: 49,
                },
                priority: 18,
                color2: 6654968,
                createdAt: "2021-11-30T23:41:42.940Z",
                updatedAt: "2022-07-02T00:14:29.845Z",
                isMentionable: false,
                isSelfAssignable: false,
                isDisplayedSeparately: false,
                serverId: "wlVr3Ggl",
              },
            },
          },
          null,
          4
        )}
      </pre>
      <Endpoint method="get" name="Get Current User Server Member">
        /users/@me/servers/{"{server.id}"}/member
      </Endpoint>
      <p>
        Get the access token's representing user's member object for a specific
        server. This is not available if the server is private. Requires the{" "}
        <InlineCode>servers.members.read</InlineCode> scope and, for an inner{" "}
        <InlineCode>user</InlineCode> object to be included, the{" "}
        <InlineCode>identify</InlineCode> scope.
      </p>
      <AnchoredHeader
        size="md"
        id="get-current-user-server-member-query-parameters"
      >
        Query Parameters
      </AnchoredHeader>
      <table className={tableStyle}>
        <thead>
          <tr>
            <td className={trtdStyle}>Parameter</td>
            <td className={trtdStyle}>Description</td>
            <td className={trtdStyle}>Required</td>
            <td className={trtdStyle}>Default</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdStyle}>getPermissions</td>
            <td className={tdStyle}>
              Whether to return the member's calculated permissions at a server
              level (slower)
            </td>
            <td className={tdStyle}>no</td>
            <td className={tdStyle}>false</td>
          </tr>
        </tbody>
      </table>
      <AnchoredHeader size="md" id="get-current-user-server-member-response">
        JSON Response
      </AnchoredHeader>
      <table className={tableStyle}>
        <thead>
          <tr>
            <td className={trtdStyle}>Field</td>
            <td className={trtdStyle}>Type</td>
            <td className={trtdStyle}>Description</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdStyle}>user?</td>
            <td className={tdStyle}>object (user)</td>
            <td className={tdStyle}>
              The member's inner user. Will contain <InlineCode>id</InlineCode>{" "}
              and <InlineCode>name</InlineCode> at minimum. Only present if you
              have the <InlineCode>identify</InlineCode> scope.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>teamXp?</td>
            <td className={tdStyle}>integer</td>
            <td className={tdStyle}>
              The member's XP in this server. Only present if{" "}
              <InlineCode>getPermissions</InlineCode> was false.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>membershipRole?</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              A generic string denoting the member's "role" in this server based
              on their permissions. This is unrelated to any roles they have.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>joinedAt</td>
            <td className={tdStyle}>?string (ISO8601 timestamp)</td>
            <td className={tdStyle}>
              When the member joined this server. Only present if{" "}
              <InlineCode>getPermissions</InlineCode> was false.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>roleIds?</td>
            <td className={tdStyle}>integer[]</td>
            <td className={tdStyle}>
              The member's role IDs in this server. Only present if{" "}
              <InlineCode>getPermissions</InlineCode> was true.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>nickname?</td>
            <td className={tdStyle}>string</td>
            <td className={tdStyle}>
              The member's nickname in this server. Only present if{" "}
              <InlineCode>getPermissions</InlineCode> was true and if the member
              has a nickname set.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>isOwner?</td>
            <td className={tdStyle}>boolean</td>
            <td className={tdStyle}>
              Whether the member owns this server. Only present if{" "}
              <InlineCode>getPermissions</InlineCode> was true.
            </td>
          </tr>
          <tr>
            <td className={tdStyle}>permissions?</td>
            <td className={tdStyle}>object (string:integer)</td>
            <td className={tdStyle}>
              The member's calculated permissions in this server. Only present
              if <InlineCode>getPermissions</InlineCode> was true.
            </td>
          </tr>
        </tbody>
      </table>
      <AnchoredHeader size="md" id="get-current-user-server-member-example">
        JSON Response Example
      </AnchoredHeader>
      <p>
        This example provides the <InlineCode>getPermissions</InlineCode> query
        parameter as false (or not present). For more details on what this
        parameter changes, see the above table.
      </p>
      <pre className={preStyle}>
        {JSON.stringify(
          {
            user: {
              id: "EdVMVKR4",
              name: "shay",
              avatar:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/UserAvatar/c2da767cf9795e7c73facc399159fefc-Large.png?w=450&h=450",
              userStatus: {
                content: null,
                customReactionId: 925765,
                customReaction: {
                  id: 925765,
                  name: "blobspider",
                  png: "https://s3-us-west-2.amazonaws.com/www.guilded.gg/CustomReaction/b721e28333392c335fcff52eb27997fd-Full.webp?w=120&h=120",
                  webp: "https://s3-us-west-2.amazonaws.com/www.guilded.gg/CustomReaction/b721e28333392c335fcff52eb27997fd-Full.webp?w=120&h=120",
                  apng: null,
                },
              },
              stonks: 56,
              lastOnline: "2022-04-19T17:02:55.499Z",
            },
            teamXp: 1551,
            membershipRole: "admin",
            joinedAt: "2021-08-02T16:59:54.724Z",
          },
          null,
          4
        )}
      </pre>
      <p className="mt-2">
        Inversely to the above, the following example provides the{" "}
        <InlineCode>getPermissions</InlineCode> query parameter as true:
      </p>
      <pre className={preStyle}>
        {JSON.stringify(
          {
            user: {
              id: "EdVMVKR4",
              name: "shay",
              userPresenceStatus: 2,
              avatar:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/UserAvatar/c2da767cf9795e7c73facc399159fefc-Large.png?w=450&h=450",
              banner:
                "https://s3-us-west-2.amazonaws.com/www.guilded.gg/UserBanner/acaa9d0f78dd8cdd93f3ce44d14c0260-Hero.png?w=1500&h=500",
            },
            membershipRole: "admin",
            nickname: "this shay",
            roleIds: [24821967],
            isOwner: true,
            permissions: {
              chat: 499,
              docs: 3,
              forms: 16,
              lists: 3,
              media: 3,
              voice: 6211,
              forums: 67,
              general: 8192,
              streams: 51,
              calendar: 3,
              scheduling: 3,
              announcements: 2,
              customization: 16,
            },
          },
          null,
          4
        )}
      </pre>
    </div>
  );
}

import { Innertube, Session } from "youtubei.js/cf-worker";
import { updateCookieValues } from "./cookies/cookie-manager";
import { Context } from "hono";
import { Bindings } from "..";
import Cookie from "./cookies/cookie";

const PLAYER_REFRESH_PERIOD = 1000 * 60 * 15; // ms

let innertube: Innertube;
let lastRefreshedAt: number;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const transformSessionData = (cookie: any) => {
  if (!cookie) return;

  const values = { ...cookie.values() };
  const REQUIRED_VALUES = ["access_token", "refresh_token"];

  if (REQUIRED_VALUES.some((x) => typeof values[x] !== "string")) {
    return;
  }

  if (values.expires) {
    values.expiry_date = values.expires;

    delete values.expires;
  } else if (!values.expiry_date) {
    return;
  }

  return values;
};

const customFetch = (
  input: RequestInfo | URL,
  init?: any
): Promise<Response> => {
  if (init && "credentials" in init) {
    const { credentials, ...rest } = init;
    //@ts-ignore
    return fetch(input, rest);
  }
  //@ts-ignore
  return fetch(input, init);
};

export function getCookie(service: string, c: Context<{ Bindings: Bindings }>) {
  let cookies: any = {};
  const COUNTER = Symbol("counter");
  cookies = JSON.parse(c.env.COOKIE);
  // if (!cookies) {
  //   setup(c.env.cookies);
  // }
  if (!cookies[service] || !cookies[service].length) return;

  let n;
  if (cookies[service][COUNTER] === undefined) {
    n = cookies[service][COUNTER] = 0;
  } else {
    ++cookies[service][COUNTER];
    n = cookies[service][COUNTER] %= cookies[service].length;
  }

  const cookie = cookies[service][n];
  if (typeof cookie === "string")
    cookies[service][n] = Cookie.fromString(cookie);

  return cookies[service][n];
}

export const cloneInnertube = async (
  c: Context<{ Bindings: Bindings }>
): Promise<Innertube> => {
  const currentTime = Date.now();
  const shouldRefreshPlayer =
    !lastRefreshedAt || currentTime - lastRefreshedAt > PLAYER_REFRESH_PERIOD;
  if (!innertube || shouldRefreshPlayer) {
    innertube = await Innertube.create({
      //@ts-ignore
      fetch: customFetch,
    });
    lastRefreshedAt = currentTime;
  }

  const session = new Session(
    innertube.session.context,
    innertube.session.key,
    innertube.session.api_version,
    innertube.session.account_index,
    innertube.session.player,
    undefined,
    //@ts-ignore
    customFetch,
    innertube.session.cache
  );

  const cookie = getCookie("youtube_oauth", c);

  console.log("cookie", cookie);

  const oauthData = transformSessionData(cookie);

  if (!session.logged_in && oauthData) {
    await session.oauth.init(oauthData);
    session.logged_in = true;
  }

  if (session.logged_in) {
    if (session.oauth.shouldRefreshToken()) {
      await session.oauth.refreshAccessToken();
    }

    const cookieValues = cookie.values();
    const oldExpiry = new Date(cookieValues.expiry_date);
    const newExpiry = session?.oauth?.oauth2_tokens?.expiry_date
      ? new Date(session.oauth.oauth2_tokens.expiry_date)
      : oldExpiry;

    if (oldExpiry.getTime() !== newExpiry.getTime()) {
      //@ts-ignore
      updateCookieValues(cookie, {
        ...session.oauth.client_id,
        ...session.oauth.oauth2_tokens,
        expiry_date: newExpiry.toISOString(),
      });
    }
  }

  return new Innertube(session);
};

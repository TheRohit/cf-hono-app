import { writeFile } from "node:fs/promises";
import { parseSetCookie, splitCookiesString } from "set-cookie-parser";
import Cookie from "./cookie";

const WRITE_INTERVAL = 60000;

const COUNTER = Symbol("counter");

let cookies = {};
let dirty = false;
let intervalId;

const setup = async (c) => {
  const cookie = {
    youtube_oauth: [
      "access_token=ya29.a0AcM612zqRwLcLmPRpXkUh9Wwmja7AFo8ecO9nDEtTBB0bDGJmdx1Un7t7vcM7s8YofbQ4ZsMe1hRqmnCTYKZ_0laVkRHzyEF5wUt_UlWyYw6FLmbgXhDUH_WV2s2Nx2PRnhADB1B9ZI1f3zJ3RoDlrXKoDJi5zj8WjsF8UXmp__D65NYgZxJaCgYKAbESARASFQHGX2MiGOyFgly316djaqDlxntCrQ0187; refresh_token=1//0gkNXoxg8RvrNCgYIARAAGBASNwF-L9IrnbIgsOpZZHdjzlMOvlRdwWOs7FEWytL2Q3f4X574168x557EJL6f47kypIpSySifHq4; scope=https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube-paid-content; token_type=Bearer; expiry_date=2024-09-14T02:47:13.300Z",
    ],
  };
  try {
    if (!cookie) return;

    cookies = JSON.parse(cookie);
    console.log("Cookies", cookies);

    intervalId = setInterval(writeChanges, WRITE_INTERVAL);
  } catch {
    /* no cookies for you */
  }
};

function writeChanges() {
  if (!dirty) return;
  dirty = false;

  writeFile(cookiePath, JSON.stringify(cookies, null, 4)).catch(() => {
    clearInterval(intervalId);
  });
}

setup();
export function getCookie(service, c) {
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

export function updateCookie(cookie, headers) {
  if (!cookie) return;

  const parsed = parseSetCookie(splitCookiesString(headers.get("set-cookie")), {
    decodeValues: false,
  });
  const values = {};

  cookie.unset(parsed.filter((c) => c.expires < new Date()).map((c) => c.name));
  // biome-ignore lint/complexity/noForEach: <explanation>
  // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
  parsed
    .filter((c) => !c.expires || c.expires > new Date())
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    .forEach((c) => (values[c.name] = c.value));
  updateCookieValues(cookie, values);
}

export function updateCookieValues(cookie, values) {
  cookie.set(values);
  if (Object.keys(values).length) dirty = true;
}

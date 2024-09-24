import { Context } from "hono";
import { Cookie } from "tough-cookie";
import { Bindings } from "../..";
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function getCookie(
  name: string,
  c: Context<{ Bindings: Bindings }>
): any;

export function updateCookieValues(
  cookie: Cookie,
  values: Record<string, string | number | Date>
): void;

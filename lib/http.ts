import { NextResponse } from "next/server";
import { getUser, type User } from "./auth";

export const go = (req: Request, to: string) => NextResponse.redirect(new URL(to, req.url), 303);

/** Runs a route handler for a signed-in user; anonymous requests go to /login. */
export async function withUser(req: Request, fn: (user: User) => Promise<Response>): Promise<Response> {
  const user = await getUser();
  if (!user) return go(req, "/login");
  return fn(user);
}

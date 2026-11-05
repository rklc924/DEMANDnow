import { publicOrigin } from "./origin";
import { NextResponse } from "next/server";
import { getUser, type User } from "./auth";
import { readDB } from "./store";

export const go = (req: Request, to: string) => NextResponse.redirect(new URL(to, publicOrigin(req)), 303);

/** Runs a route handler for a signed-in user. Anonymous requests go to /login; accounts without a card on file go to add one. */
export async function withUser(req: Request, fn: (user: User) => Promise<Response>, opts: { card?: boolean } = {}): Promise<Response> {
  const user = await getUser();
  if (!user) return go(req, "/login");
  if (opts.card !== false && !(await readDB(user.id)).card) return go(req, "/billing/card");
  return fn(user);
}

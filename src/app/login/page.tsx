import { redirect } from "next/navigation";

/** The sign-in form now lives at the site root; keep old /login links working. */
export default function LoginRedirect() {
  redirect("/");
}

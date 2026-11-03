import { redirect } from "next/navigation";

/** Students now register from the tournament registration page (pincode first). */
export default function RegisterRedirect() {
  redirect("/enter");
}

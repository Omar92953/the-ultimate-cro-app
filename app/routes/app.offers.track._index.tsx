/** The list of Track page offers is the Offers hub (they are one more type there). */
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { redirect } = await authenticate.admin(request);
  return redirect("/app/offers");
};

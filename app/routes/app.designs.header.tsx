/** The Header, Footer and Contact page features were removed (themes already do these well): old links go to Storefront. */
import { redirect, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return redirect("/app/library");
};

/**
 * A category of the app (Offers & bundles, Sections, Boosters, Header & pages): the same cards as
 * Home, for that category only. The side menu links here.
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { HomeView, action, loader as homeLoader } from "./app._index";
import { isCategory } from "../lib/catalog";

export const loader = async (args: LoaderFunctionArgs) => {
  if (!isCategory(args.params.cat)) throw new Response("Not found", { status: 404 });
  return homeLoader(args);
};

export { action };

export default function CategoryPage() {
  const { cat } = useParams();
  return <HomeView key={cat} only={isCategory(cat) ? cat : "offers"} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

/**
 * POST /api/post-purchase/offer — called by the cro-post-purchase extension before it shows the
 * offer (lib/post-purchase-api.server.ts). Called from checkout, so it answers cross-origin requests.
 */
import type { ActionFunctionArgs } from "react-router";
import { postOnlyLoader } from "../lib/cors";
import { offerAction } from "../lib/post-purchase-api.server";

// The browser's OPTIONS preflight reaches the loader (React Router), so the loader answers it.
export const loader = postOnlyLoader;
export const action = ({ request }: ActionFunctionArgs) => offerAction(request);

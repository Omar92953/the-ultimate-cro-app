/**
 * POST /api/post-purchase/sign — called by the cro-post-purchase extension when the shopper accepts
 * the offer (lib/post-purchase-api.server.ts). Called from checkout, so it answers cross-origin requests.
 */
import type { ActionFunctionArgs } from "react-router";
import { postOnlyLoader } from "../lib/cors";
import { signAction } from "../lib/post-purchase-api.server";

// The browser's OPTIONS preflight reaches the loader (React Router), so the loader answers it.
export const loader = postOnlyLoader;
export const action = ({ request }: ActionFunctionArgs) => signAction(request);

/**
 * POST /site/notify: the website's "Email me at launch" form (site/src/components/NotifyCta.astro). Public. The
 * site sends it with fetch (a simple form post, so no CORS preflight) and gets JSON; without JavaScript the
 * browser posts the form itself and gets a small page back. Logic: app/lib/launch-signup.server.ts.
 */
import type { ActionFunctionArgs } from "react-router";
import { SITE, handleSignup } from "../lib/launch-signup.server";

export const action = ({ request }: ActionFunctionArgs) => handleSignup(request);

// A person opening the address: send them to the site.
export const loader = () => new Response(null, { status: 302, headers: { Location: `${SITE}/#get-notified` } });

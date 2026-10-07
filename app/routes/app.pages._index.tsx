import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getThemeStatus } from "../lib/cro.server";
import { getContact } from "../lib/pages.server";
import { PAGE_TYPES } from "../lib/pages";
import { Button } from "../components/fields";
import { Card, CardGrid, CardText, Explainer, Pill } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const [contact, theme] = await Promise.all([getContact(admin), getThemeStatus(admin).catch(() => null)]);
  return { contactSaved: contact.saved, contactInTheme: theme ? theme.installed.contact : null };
};

export default function Pages() {
  const data = useLoaderData<typeof loader>();
  const contactStatus = !data.contactSaved
    ? { tone: "warn" as const, text: "Not designed yet" }
    : data.contactInTheme === false
      ? { tone: "warn" as const, text: "Not in theme" }
      : { tone: "ok" as const, text: "Live" };
  return (
    <s-page heading="Pages" inlineSize="large">
      <s-stack gap="base">
        <Explainer
          what="Whole pages designed here in the app: every field, text, colour and size, with a live preview."
          how="Design a page here, then add its block to the matching page template in the theme editor (one click from each page). Changes you save here show on your store right away."
          example="Your Contact page: name, email, phone and message fields in your colours, with your WhatsApp and opening hours next to the form."
        />
        <CardGrid cols={2}>
          {PAGE_TYPES.map((p) => (
            <Card
              key={p.key}
              title={p.title}
              badge={p.ready ? (p.key === "contact" ? <Pill tone={contactStatus.tone}>{contactStatus.text}</Pill> : null) : <Pill tone="muted">Coming soon</Pill>}
              actions={
                p.ready ? (
                  <Button variant="primary" href={`/app/pages/${p.key}`} icon="edit">
                    Design
                  </Button>
                ) : null
              }
            >
              <CardText>{p.text}</CardText>
            </Card>
          ))}
        </CardGrid>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

/**
 * The email service behind loyalty emails. Postmark today, behind this small interface so another service
 * (Resend) can replace it: send in batches, sending domains (the store's own sender) and bounce webhooks.
 *
 * Postmark needs POSTMARK_SERVER_TOKEN (sending) and POSTMARK_ACCOUNT_TOKEN (sending domains), typed into
 * Render by Omar. Without them nothing is sent and the Emails page says the service isn't ready.
 */
const API = "https://api.postmarkapp.com";

export type OutMail = {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** "account": transactional stream; "reminder": broadcast stream (marketing). */
  stream: "account" | "reminder";
  headers: { name: string; value: string }[];
  tag: string;
  metadata: Record<string, string>;
};
export type SendResult = { ok: boolean; id: string; error: string };
export type DomainRecords = {
  id: string;
  domain: string;
  dkimHost: string;
  dkimValue: string;
  returnPathHost: string;
  returnPathValue: string;
  dkimVerified: boolean;
  returnPathVerified: boolean;
};

export interface MailProvider {
  ready(): boolean;
  /** Can add sending domains (the store's own sender). */
  domainsReady(): boolean;
  send(mails: OutMail[]): Promise<SendResult[]>;
  addDomain(domain: string): Promise<DomainRecords>;
  getDomain(id: string): Promise<DomainRecords | null>;
  verifyDomain(id: string): Promise<DomainRecords | null>;
  ensureWebhook(url: string): Promise<void>;
}

export class ProviderError extends Error {}

type Fetch = typeof fetch;
type PmDomain = { ID: number; Name: string; DKIMVerified: boolean; DKIMPendingHost?: string; DKIMPendingTextValue?: string; DKIMHost?: string; DKIMTextValue?: string; ReturnPathDomain?: string; ReturnPathDomainCNAMEValue?: string; ReturnPathDomainVerified: boolean };

const records = (d: PmDomain): DomainRecords => ({
  id: String(d.ID),
  domain: d.Name,
  // Until DKIM is verified Postmark gives the key to add as "pending".
  dkimHost: d.DKIMVerified ? d.DKIMHost || d.DKIMPendingHost || "" : d.DKIMPendingHost || d.DKIMHost || "",
  dkimValue: d.DKIMVerified ? d.DKIMTextValue || d.DKIMPendingTextValue || "" : d.DKIMPendingTextValue || d.DKIMTextValue || "",
  returnPathHost: d.ReturnPathDomain || `pm-bounces.${d.Name}`,
  returnPathValue: d.ReturnPathDomainCNAMEValue || "pm.mtasv.net",
  dkimVerified: !!d.DKIMVerified,
  returnPathVerified: !!d.ReturnPathDomainVerified,
});

export function postmark(env: { server?: string; account?: string; broadcast?: string } = {}, http: Fetch = fetch): MailProvider {
  const server = () => env.server ?? process.env.POSTMARK_SERVER_TOKEN ?? "";
  const account = () => env.account ?? process.env.POSTMARK_ACCOUNT_TOKEN ?? "";
  const broadcast = () => env.broadcast ?? process.env.POSTMARK_BROADCAST_STREAM ?? "broadcast";
  const call = async <T>(path: string, init: { method?: string; body?: unknown; token: "server" | "account" }): Promise<T> => {
    const token = init.token === "server" ? server() : account();
    if (!token) throw new ProviderError("The email service is not set up yet.");
    const res = await http(`${API}${path}`, {
      method: init.method ?? "GET",
      headers: { Accept: "application/json", "Content-Type": "application/json", [init.token === "server" ? "X-Postmark-Server-Token" : "X-Postmark-Account-Token"]: token },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const json = (await res.json().catch(() => ({}))) as T & { ErrorCode?: number; Message?: string };
    if (!res.ok) throw new ProviderError(json?.Message || `Postmark answered ${res.status}`);
    return json;
  };
  return {
    ready: () => !!server(),
    domainsReady: () => !!account(),
    async send(mails) {
      const out: SendResult[] = [];
      for (let i = 0; i < mails.length; i += 500) {
        const part = mails.slice(i, i + 500);
        // One batch per stream (a batch goes to one stream).
        for (const stream of ["account", "reminder"] as const) {
          const list = part.map((m, j) => ({ m, j })).filter((x) => x.m.stream === stream);
          if (!list.length) continue;
          try {
            const res = await call<{ ErrorCode: number; Message: string; MessageID?: string }[]>("/email/batch", {
              method: "POST",
              token: "server",
              body: list.map(({ m }) => ({ From: m.from, To: m.to, ReplyTo: m.replyTo || undefined, Subject: m.subject, HtmlBody: m.html, TextBody: m.text, MessageStream: stream === "account" ? "outbound" : broadcast(), Headers: m.headers.map((h) => ({ Name: h.name, Value: h.value })), Tag: m.tag, Metadata: m.metadata, TrackOpens: false, TrackLinks: "None" })),
            });
            list.forEach(({ j }, n) => {
              const r = res[n];
              out[i + j] = r && r.ErrorCode === 0 ? { ok: true, id: r.MessageID ?? "", error: "" } : { ok: false, id: "", error: r?.Message ?? "Not sent" };
            });
          } catch (e) {
            for (const { j } of list) out[i + j] = { ok: false, id: "", error: e instanceof Error ? e.message : "Not sent" };
          }
        }
      }
      return out;
    },
    async addDomain(domain) {
      try {
        return records(await call<PmDomain>("/domains", { method: "POST", token: "account", body: { Name: domain, ReturnPathDomain: `pm-bounces.${domain}` } }));
      } catch (e) {
        // Added before (by this store or again after a change): use the one there.
        if (!(e instanceof ProviderError) || !/exist/i.test(e.message)) throw e;
        const list = await call<{ Domains: { ID: number; Name: string }[] }>("/domains?count=500&offset=0", { token: "account" });
        const found = list.Domains.find((d) => d.Name.toLowerCase() === domain.toLowerCase());
        if (!found) throw e;
        return records(await call<PmDomain>(`/domains/${found.ID}`, { token: "account" }));
      }
    },
    async getDomain(id) {
      try {
        return records(await call<PmDomain>(`/domains/${encodeURIComponent(id)}`, { token: "account" }));
      } catch (e) {
        if (e instanceof ProviderError && /not found|doesn't exist|does not exist/i.test(e.message)) return null;
        throw e;
      }
    },
    async verifyDomain(id) {
      await call(`/domains/${encodeURIComponent(id)}/verifyDkim`, { method: "PUT", token: "account" }).catch(() => null);
      await call(`/domains/${encodeURIComponent(id)}/verifyReturnPath`, { method: "PUT", token: "account" }).catch(() => null);
      return this.getDomain(id);
    },
    async ensureWebhook(url) {
      for (const stream of ["outbound", broadcast()]) {
        const have = await call<{ Webhooks: { Url: string }[] }>(`/webhooks?MessageStream=${encodeURIComponent(stream)}`, { token: "server" });
        if (have.Webhooks.some((w) => w.Url === url)) continue;
        await call("/webhooks", { method: "POST", token: "server", body: { Url: url, MessageStream: stream, Triggers: { Bounce: { Enabled: true, IncludeContent: false }, SpamComplaint: { Enabled: true, IncludeContent: false }, SubscriptionChange: { Enabled: true } } } });
      }
    },
  };
}

/** The provider the app uses (tests pass their own). */
let current: MailProvider | null = null;
export const mailProvider = () => (current ??= postmark());
export const setMailProvider = (p: MailProvider | null) => {
  current = p;
};

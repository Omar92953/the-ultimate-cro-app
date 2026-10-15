/** Saves and lists a shop's feature requests (model FeatureRequest). */
import db from "../db.server";
import type { RequestStatus } from "./feature-requests";

export type FeatureRequestRow = { id: number; text: string; place: string; status: RequestStatus; createdAt: string };

export async function createFeatureRequest(shop: string, plan: string, text: string, place: string) {
  await db.featureRequest.create({ data: { shop, plan, text, place } });
}

/** The shop's latest requests, newest first. */
export async function listFeatureRequests(shop: string, take = 10): Promise<FeatureRequestRow[]> {
  const rows = await db.featureRequest.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take });
  return rows.map((r) => ({ id: r.id, text: r.text, place: r.place, status: r.status as RequestStatus, createdAt: r.createdAt.toISOString() }));
}

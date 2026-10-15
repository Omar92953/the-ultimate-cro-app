/**
 * Articles (/blog/) and help guides (/help/): one Markdown file each. To add an article, add a file
 * to src/content/blog with the fields below; it appears on /blog/, its category page, the sitemap
 * and llms.txt on the next build.
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { FEATURE_KEYS } from "../../app/lib/catalog";

const feature = z.enum(FEATURE_KEYS as [string, ...string[]]);

export const CATEGORIES = ["Bundles & AOV", "Product pages", "Cart & checkout", "Store design", "Guides"] as const;

const blog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(200),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.enum(CATEGORIES),
    /** A demo screenshot for the cover: "features/<feature>" or "bundles/<recipe>". */
    cover: z.string(),
    coverAlt: z.string(),
    author: z.string().default("The CRO Toolbox team"),
    /** The feature the call to action points to. */
    feature: feature,
  }),
});

const help = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/help" }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(200),
    order: z.number(),
    /** Features this guide covers (their feature pages link here). */
    features: z.array(feature).default([]),
  }),
});

export const collections = { blog, help };

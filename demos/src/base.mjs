/**
 * Where the demos live on the website: https://crotoolbox.com/demo/. Every absolute address the demo
 * pages write starts with BASE, so they never resolve to a page of the website itself. The build writes
 * the pages to dist/demo/ (dist is laid out like the website's root); the website build copies that
 * folder into its own dist (site/scripts/with-demos.mjs).
 */
export const BASE = "/demo";

// Lets `node --test` load the app's TypeScript (shared, non-server files) directly: relative
// imports without an extension ("./deals") resolve to the .ts file, as Vite does.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { existsSync } from "node:fs";
      import { fileURLToPath } from "node:url";
      export async function resolve(specifier, context, next) {
        if (/^\\.\\.?\\//.test(specifier) && !/\\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL) {
          const url = new URL(specifier + ".ts", context.parentURL);
          if (existsSync(fileURLToPath(url))) return next(url.href, context);
        }
        return next(specifier, context);
      }
    `),
  import.meta.url,
);

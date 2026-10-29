// Prints the build tools' names, descriptions and argument schemas (for writing showcase steps).
import { BUILD_TOOLS, PUBLISH_TOOLS } from "../../app/lib/mcp/build-tools.server";
import { DEAL_TOOLS } from "../../app/lib/mcp/deal-tools.server";
import { BUNDLE_TOOLS } from "../../app/lib/mcp/bundle-tools.server";
for (const t of [...BUILD_TOOLS, ...DEAL_TOOLS, ...BUNDLE_TOOLS, ...PUBLISH_TOOLS]) console.log("##", t.name, "\n", t.description.slice(0, 300), "\n", JSON.stringify(t.schema).slice(0, 2000), "\n");

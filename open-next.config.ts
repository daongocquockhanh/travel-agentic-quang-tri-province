import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Defaults: no incremental cache. Pages are dynamic and content is bundled at build time.
export default defineCloudflareConfig();

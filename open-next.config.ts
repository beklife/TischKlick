import {defineCloudflareConfig} from '@opennextjs/cloudflare';

// No incremental cache configured: all app routes are either fully static or
// force-dynamic, so ISR/regional caching brings nothing at this stage.
export default defineCloudflareConfig();

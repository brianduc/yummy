// LEGACY: Cloudflare deployment path — gated as part of AWS migration (T11).
// This file previously configured @opennextjs/cloudflare for Workers deployment.
// The active deployment target is AWS (App Runner + Amplify).
// Do not restore without re-adding @opennextjs/cloudflare to devDependencies.
//
// Original content:
//   import { defineCloudflareConfig } from '@opennextjs/cloudflare';
//   export default defineCloudflareConfig({});

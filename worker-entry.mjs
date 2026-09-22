import handler from './.open-next/worker.js';
import { routeReaderRequest } from './lib/readerRequestRouting.mjs';
export * from './.open-next/worker.js';
export default {
  fetch(request, env, ctx) {
    return routeReaderRequest(request, env, ctx, handler);
  },
};

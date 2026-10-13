"use strict";

/* Keep reconnect attempts bounded with the visitor presence backoff schedule. */
window.DG_VISITOR_PRESENCE_RETRY_DELAY={
 resolve(attempt){return Math.min(30000,1500*2**Math.min(attempt,4));}
};

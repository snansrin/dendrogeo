"use strict";

/* Open the existing mail draft; the service supplies its already-encoded subject. */
window.DG_DATA_REQUEST_REPLY_WINDOW={
 open(browser,email,encodedSubject,body){
  return browser.open("mailto:"+email+"?subject="+encodedSubject+"&body="+encodeURIComponent(body),"_blank");
 }
};

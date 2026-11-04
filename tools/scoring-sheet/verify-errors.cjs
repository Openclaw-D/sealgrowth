'use strict';
// An exclusion is valid only for this injected response, URL, method and step.
function expectedFailure(event, expectedURL) {
  return event.step==='injected-save-failure' && event.url===expectedURL &&
    event.method==='POST' && event.status===500 && event.injected===true;
}
function expectedConsole(event, expectedURL) {
  return expectedFailure(event,expectedURL) &&
    event.text==='Failed to load resource: the server responded with a status of 500 (Internal Server Error)';
}
module.exports={expectedFailure,expectedConsole};

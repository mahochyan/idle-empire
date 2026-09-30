// Isolated review origin only: track startup timers so the fixture can freeze time.
window.uiReviewTimers={original:window.setInterval,ids:[]};
window.setInterval=function(...args){
  const id=window.uiReviewTimers.original.apply(window,args);
  window.uiReviewTimers.ids.push(id);return id;
};

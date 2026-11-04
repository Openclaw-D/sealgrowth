'use strict';
// One failed operation must not cancel later independent checks or screenshots.
async function attempt(name, operation, report) {
  try { return {ok:true,value:await operation()}; }
  catch (error) { report(name,false,String(error.message||error).slice(0,4000)); return {ok:false}; }
}
module.exports = {attempt};

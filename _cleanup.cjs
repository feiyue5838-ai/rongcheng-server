const fs = require('fs');
const files = [
  'check-health.cjs','check-health2.cjs','check-health3.cjs','check-health4.cjs',
  'check-tmpl.cjs','chk-review.cjs','fix-api.cjs','fix-issues.cjs','test-review.cjs'
];
files.forEach(f => {
  try { fs.unlinkSync(f); console.log('deleted:', f); }
  catch(e) { console.log('skip:', f); }
});

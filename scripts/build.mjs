import fs from 'node:fs';
fs.rmSync('public',{recursive:true,force:true});
fs.cpSync('web','public',{recursive:true});
fs.copyFileSync('scripts/auth-source.js','public/auth.js');
console.log('Built Vercel website and supervisor PIN and student QR login.');

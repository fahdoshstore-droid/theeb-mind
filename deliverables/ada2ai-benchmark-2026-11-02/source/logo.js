const sharp=require('sharp');
const svg=`<svg viewBox="0 0 100 100" width="512" height="512" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00DCC8"/><stop offset="100%" stop-color="#007ABA"/></linearGradient></defs><path d="M50 5 L85 25 L85 65 L50 95 L15 75 L15 25 L50 5 L50 18 L28 30 L28 70 L50 82 L72 70 L72 35 L60 45 L50 35 L65 15 L50 5 Z" fill="url(#g)" fill-rule="evenodd"/><path d="M48 20 L68 20 L45 50 L65 50 L35 85 L48 45 L32 45 Z" fill="#ffffff"/></svg>`;
sharp(Buffer.from(svg)).png().toFile('logo.png').then(()=>console.log('ok'));
// pitch geometry background for cover/closing
const W=1920,H=1080;
const pitch=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#000A0F"/>
<g fill="none" stroke="#00DCC8" stroke-opacity="0.16" stroke-width="2">
<rect x="140" y="110" width="1640" height="860"/><line x1="960" y1="110" x2="960" y2="970"/><circle cx="960" cy="540" r="140"/>
<rect x="140" y="330" width="250" height="420"/><rect x="1530" y="330" width="250" height="420"/><rect x="140" y="440" width="90" height="200"/><rect x="1690" y="440" width="90" height="200"/>
<path d="M390 450 A110 110 0 0 1 390 630"/><path d="M1530 450 A110 110 0 0 0 1530 630"/></g>
<g fill="#00DCC8" fill-opacity="0.35">${Array.from({length:22},(_,i)=>{const x=300+((i*277)%1350),y=180+((i*191)%720);return `<circle cx="${x}" cy="${y}" r="5"/>`}).join('')}</g>
<rect width="100%" height="100%" fill="#000A0F" fill-opacity="0.35"/></svg>`;
sharp(Buffer.from(pitch)).png().toFile('pitch.png').then(()=>console.log('ok2'));

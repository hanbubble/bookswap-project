const pendingUser = (() => {
  try { return JSON.parse(sessionStorage.getItem('pendingUser')); }
  catch { return null; }
})();

if (!pendingUser) window.location.href = 'login.html';
if (getCurrentUser()) window.location.href = 'waiting.html';

document.getElementById('wait-name').textContent = pendingUser.name + '님, 안녕하세요!';

// ── 패치워크 배경 ──────────────────────────────────────────
const _PAL = ['#E8879A','#C23050','#A82040','#2B3A6E','#1E2B5A','#8BC66A','#6A9A40','#E8C840','#5BA8D4','#7AD4C0','#F5E6C8','#FAD8E8'];
function _rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296};}
function _pFlower(ctx,ox,oy,S,col,rng){const cols=4,rows=4,stepX=S/cols,stepY=S/rows;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const cx=ox+stepX*(c+.5),cy=oy+stepY*(r+.5),pr=1.2+rng()*1.5;ctx.fillStyle=col;ctx.globalAlpha=.82;for(let p=0;p<5;p++){const a=p/5*Math.PI*2;ctx.beginPath();ctx.arc(cx+Math.cos(a)*pr*1.7,cy+Math.sin(a)*pr*1.7,pr,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#FFE566';ctx.globalAlpha=1;ctx.beginPath();ctx.arc(cx,cy,pr*.6,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
function _pDots(ctx,ox,oy,S,col){ctx.fillStyle=col;ctx.globalAlpha=1;const sp=18,r=5;for(let dy=sp/2;dy<S;dy+=sp)for(let dx=sp/2;dx<S;dx+=sp){ctx.beginPath();ctx.arc(ox+dx,oy+dy,r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
function _pVStripe(ctx,ox,oy,S,col){ctx.fillStyle=col;ctx.globalAlpha=.55;for(let dx=1;dx<S;dx+=7)ctx.fillRect(ox+dx,oy,3,S);ctx.globalAlpha=1;}
function _pPlaid(ctx,ox,oy,S,col){ctx.fillStyle=col;ctx.globalAlpha=.5;for(let dx=0;dx<S;dx+=13)ctx.fillRect(ox+dx,oy,6,S);ctx.globalAlpha=.38;for(let dy=0;dy<S;dy+=13)ctx.fillRect(ox,oy+dy,S,6);ctx.globalAlpha=1;}
function _pDiag(ctx,ox,oy,S,col){ctx.strokeStyle=col;ctx.lineWidth=3;ctx.globalAlpha=.5;for(let i=-S;i<S*2;i+=10){ctx.beginPath();ctx.moveTo(ox+i,oy);ctx.lineTo(ox+i+S,oy+S);ctx.stroke();}ctx.globalAlpha=1;}
function _pShapes(ctx,ox,oy,S,col,rng){const cols=3,rows=3,stepX=S/cols,stepY=S/rows,fs=stepX*.62;ctx.font=fs+'px MonaS12,serif';ctx.textAlign='center';ctx.textBaseline='middle';for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)ctx.fillText('🍓',ox+stepX*(c+.5),oy+stepY*(r+.5));}
function drawPatchwork(){const canvas=document.getElementById('bg-canvas');const DIM=720;canvas.width=canvas.height=DIM;const ctx=canvas.getContext('2d'),S=120,COLS=6,ROWS=6,NT=6,NP=_PAL.length,rng=_rng(20250401);const tg=Array.from({length:ROWS},()=>new Array(COLS));for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){let t;do{t=rng()*NT|0;}while((c>0&&tg[r][c-1]===t)||(r>0&&tg[r-1][c]===t));tg[r][c]=t;}const cg=Array.from({length:ROWS},()=>new Array(COLS));for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){let ci;do{ci=rng()*NP|0;}while((c>0&&cg[r][c-1]===ci)||(r>0&&cg[r-1][c]===ci));cg[r][c]=ci;}const fns=[_pFlower,_pDots,_pVStripe,_pPlaid,_pDiag,_pShapes];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const ox=c*S,oy=r*S,bi=cg[r][c],ai=(bi+2+(rng()*8|0))%NP,pr=_rng(r*97+c*53+tg[r][c]*17+3),angle=(rng()-.5)*.2;ctx.save();ctx.beginPath();ctx.rect(ox,oy,S,S);ctx.clip();ctx.fillStyle=_PAL[bi];ctx.fillRect(ox,oy,S,S);ctx.save();ctx.translate(ox+S/2,oy+S/2);ctx.rotate(angle);fns[tg[r][c]](ctx,-S/2,-S/2,S,_PAL[ai],pr);ctx.restore();ctx.restore();}ctx.setLineDash([4,4]);for(let i=0;i<=COLS;i++){const x=i*S;ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+1.5,0);ctx.lineTo(x+1.5,DIM);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,DIM);ctx.stroke();}for(let i=0;i<=ROWS;i++){const y=i*S;ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y+1.5);ctx.lineTo(DIM,y+1.5);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(DIM,y);ctx.stroke();}ctx.setLineDash([]);}
document.addEventListener('DOMContentLoaded',()=>{document.fonts.load('20px MonaS12').then(drawPatchwork).catch(drawPatchwork);});

// ── 승인 폴링 ──────────────────────────────────────────────
let _checking = false;
function checkApproval() {
  if (_checking) return;
  _checking = true;
  db.ref('users/' + pendingUser.id).once('value', snap => {
    _checking = false;
    if (!snap.exists()) return;
    const card = document.getElementById('wait-card');
    card.classList.add('approved-state');
    document.getElementById('book-icon').textContent = '🎉';
    document.getElementById('wait-sub').textContent = '승인됐어요! 입장 중...';
    sessionStorage.removeItem('pendingUser');
    sessionStorage.setItem('currentUser', JSON.stringify({ id: pendingUser.id, name: pendingUser.name }));
    setTimeout(() => { window.location.href = 'waiting.html'; }, 1400);
  });
}
checkApproval();
setInterval(checkApproval, 3000);

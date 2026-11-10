const API='';
let currentUser=null,currentRoom=null,gameLoop=null;
const H=()=>({'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('vh_token')});

async function api(path,opts={}){
  try{
    const r=await fetch(API+path,{headers:H(),...opts});
    return await r.json();
  }catch(e){return{error:'Network error'};}
}

function showTab(t){
  document.getElementById('loginForm').style.display=t==='login'?'block':'none';
  document.getElementById('registerForm').style.display=t==='register'?'block':'none';
  document.getElementById('tabLogin').className='tab-btn'+(t==='login'?' active':'');
  document.getElementById('tabRegister').className='tab-btn'+(t==='register'?' active':'');
}

async function doLogin(){
  const u=document.getElementById('loginUser').value.trim();
  const p=document.getElementById('loginPass').value;
  const m=document.getElementById('loginMsg');
  if(!u||!p){m.textContent='Fill all fields';m.style.color='red';return;}
  m.textContent='Loading...';m.style.color='#aaa';
  const d=await api('/api/login',{method:'POST',body:JSON.stringify({username:u,password:p})});
  if(d.token){
    localStorage.setItem('vh_token',d.token);
    m.textContent='Success!';m.style.color='green';
    boot();
  }else{m.textContent=d.error||'Login failed';m.style.color='red';}
}

async function doRegister(){
  const u=document.getElementById('regUser').value.trim();
  const e=document.getElementById('regEmail').value.trim();
  const p=document.getElementById('regPass').value;
  const m=document.getElementById('regMsg');
  if(!u||!e||!p){m.textContent='Fill all fields';m.style.color='red';return;}
  m.textContent='Creating...';m.style.color='#aaa';
  const d=await api('/api/register',{method:'POST',body:JSON.stringify({username:u,email:e,password:p})});
  if(d.token){
    localStorage.setItem('vh_token',d.token);
    m.textContent='Welcome!';m.style.color='green';
    boot();
  }else{m.textContent=d.error||'Register failed';m.style.color='red';}
}

function doLogout(){
  localStorage.removeItem('vh_token');
  currentUser=null;
  document.getElementById('mainApp').style.display='none';
  document.getElementById('authScreen').style.display='flex';
}

function showView(v){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('view'+v.charAt(0).toUpperCase()+v.slice(1));
  if(el)el.classList.add('active');
  if(v==='feed')loadFeed();
  if(v==='games')loadGames();
  if(v==='chat')loadChatRooms();
  if(v==='leader')loadLeaderboard();
  if(v==='profile')loadProfile();
  if(v==='admin')loadAdmin();
}

async function boot(){
  const d=await api('/api/status');
  if(d.error){doLogout();return;}
  currentUser=d;
  document.getElementById('authScreen').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('topCoins').textContent='💰 '+(d.coins||0);
  if(d.is_admin)document.getElementById('adminBtn').style.display='block';
  showView('feed');
}

async function loadFeed(){
  const d=await api('/api/feed');
  const el=document.getElementById('feedList');
  if(!d.posts||!d.posts.length){el.innerHTML='<p class="empty">No posts yet. Be the first!</p>';return;}
  el.innerHTML=d.posts.map(p=>`<div class="post-card"><div class="post-head"><strong>${p.username}</strong><span class="post-time">${p.time}</span></div><p>${p.text}</p><div class="post-stats">❤️ ${p.likes||0}</div></div>`).join('');
}

async function createPost(){
  const t=document.getElementById('postText').value.trim();
  if(!t)return;
  await api('/api/post',{method:'POST',body:JSON.stringify({text:t})});
  document.getElementById('postText').value='';
  loadFeed();
}

const GAMES=[
  {id:'g1',name:'Tic Tac Toe',icon:'❌',free:true},
  {id:'g2',name:'Snake',icon:'🐍',free:true},
  {id:'g3',name:'Memory Cards',icon:'🃏',free:true},
  {id:'g4',name:'Whack-a-Mole',icon:'🔨',free:true},
  {id:'g5',name:'Color Match',icon:'🎨',free:true},
  {id:'g6',name:'Reaction Time',icon:'⚡',free:true},
  {id:'g7',name:'Number Guess',icon:'🔢',free:true},
  {id:'g8',name:'Rock Paper Scissors',icon:'✊',free:true},
  {id:'g9',name:'Quiz',icon:'❓',free:true},
  {id:'g10',name:'Flappy Jump',icon:'🐦',free:true},
  {id:'g11',name:'Pong',icon:'🏓',free:true},
  {id:'g12',name:'Breakout',icon:'🧱',free:true},
  {id:'g13',name:'2048',icon:'🔢',free:true},
  {id:'g14',name:'Minesweeper',icon:'💣',free:true},
  {id:'g15',name:'Word Scramble',icon:'🔤',free:true},
  {id:'g16',name:'Chess Lite',icon:'♟️',free:false},
  {id:'g17',name:'Space Invaders',icon:'👾',free:false},
  {id:'g18',name:'Tetris',icon:'🟦',free:false},
  {id:'g19',name:'Pac Dash',icon:'🟡',free:false},
  {id:'g20',name:'Tower Defense',icon:'🏰',free:false},
  {id:'g21',name:'Street Race',icon:'🏎️',free:false},
  {id:'g22',name:'Fight Club',icon:'🥊',free:false},
  {id:'g23',name:'RPG Battle',icon:'⚔️',free:false}
];

function loadGames(){
  const el=document.getElementById('gameGrid');
  el.innerHTML=GAMES.map(g=>{
    const lock=!g.free&&!(currentUser&&currentUser.premium)?'<span class="lock">🔒</span>':'';
    return `<div class="game-card" onclick="openGame('${g.id}')"><span class="game-icon">${g.icon}</span><span class="game-name">${g.name}</span>${lock}</div>`;
  }).join('');
}

function openGame(id){
  const g=GAMES.find(x=>x.id===id);
  if(!g)return;
  if(!g.free&&!(currentUser&&currentUser.premium)){alert('Premium only! Go to Profile → Go Premium');return;}
  document.getElementById('gameModal').style.display='flex';
  document.getElementById('gameTitle').textContent=g.name;
  document.getElementById('gameScore').textContent='';
  api('/api/game/play',{method:'POST',body:JSON.stringify({game:id})});
  if(gameLoop){clearInterval(gameLoop);gameLoop=null;}
  const ga=document.getElementById('gameArea');
  ga.innerHTML='';
  GI[id](ga);
}

function closeGame(){
  document.getElementById('gameModal').style.display='none';
  if(gameLoop){clearInterval(gameLoop);gameLoop=null;}
  document.getElementById('gameArea').innerHTML='';
}

const GI={
g1(el){
  let b=Array(9).fill(''),turn='X',over=false;
  const w=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  el.innerHTML='<div class="ttt-board"></div><p id="tttMsg">Your turn (X)</p>';
  const bd=el.querySelector('.ttt-board');
  bd.style.cssText='display:grid;grid-template-columns:repeat(3,80px);gap:5px;justify-content:center';
  for(let i=0;i<9;i++){
    const c=document.createElement('div');
    c.style.cssText='width:80px;height:80px;background:#1e1b4b;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:32px;cursor:pointer;color:#a78bfa';
    c.onclick=()=>{
      if(b[i]||over)return;
      b[i]=turn;c.textContent=turn;
      for(const[a,x,y]of w)if(b[a]&&b[a]===b[x]&&b[x]===b[y]){over=true;el.querySelector('#tttMsg').textContent=b[a]+' wins!';return;}
      if(!b.includes('')){over=true;el.querySelector('#tttMsg').textContent='Draw!';return;}
      turn=turn==='X'?'O':'X';
      el.querySelector('#tttMsg').textContent='Turn: '+turn;
      if(turn==='O'&&!over)setTimeout(()=>{const e=b.indexOf('');if(e>=0){b[e]='O';bd.children[e].textContent='O';turn='X';el.querySelector('#tttMsg').textContent='Your turn (X)';for(const[a,x,y]of w)if(b[a]&&b[a]===b[x]&&b[x]===b[y]){over=true;el.querySelector('#tttMsg').textContent='O wins!';}}},400);
    };
    bd.appendChild(c);
  }
},
g2(el){
  let sz=20,cols=15,rows=15,snake=[{x:7,y:7}],dir={x:1,y:0},food,score=0,spd=150;
  const cv=document.createElement('canvas');cv.width=cols*sz;cv.height=rows*sz;
  cv.style.cssText='border:2px solid #7c3aed;border-radius:8px;display:block;margin:auto;background:#0f0a2a';
  el.appendChild(cv);
  const ctx=cv.getContext('2d');
  function place(){food={x:Math.floor(Math.random()*cols),y:Math.floor(Math.random()*rows)};}
  place();
  document.onkeydown=e=>{
    if(e.key==='ArrowUp'&&dir.y!==1)dir={x:0,y:-1};
    if(e.key==='ArrowDown'&&dir.y!==-1)dir={x:0,y:1};
    if(e.key==='ArrowLeft'&&dir.x!==1)dir={x:-1,y:0};
    if(e.key==='ArrowRight'&&dir.x!==-1)dir={x:1,y:0};
  };
  let td=null;
  el.innerHTML+='<div style="display:grid;grid-template-columns:repeat(3,60px);gap:5px;justify-content:center;margin-top:10px"><div></div><button onclick="document.dispatchEvent(new KeyboardEvent(\'keydown\',{key:\'ArrowUp\'}))" style="padding:10px">⬆</button><div></div><button onclick="document.dispatchEvent(new KeyboardEvent(\'keydown\',{key:\'ArrowLeft\'}))" style="padding:10px">⬅</button><button onclick="document.dispatchEvent(new KeyboardEvent(\'keydown\',{key:\'ArrowDown\'}))" style="padding:10px">⬇</button><button onclick="document.dispatchEvent(new KeyboardEvent(\'keydown\',{key:\'ArrowRight\'}))" style="padding:10px">➡</button></div>';
  gameLoop=setInterval(()=>{
    const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
    if(h.x<0||h.x>=cols||h.y<0||h.y>=rows||snake.some(s=>s.x===h.x&&s.y===h.y)){clearInterval(gameLoop);document.getElementById('gameScore').textContent='Game Over! Score: '+score;return;}
    snake.unshift(h);
    if(h.x===food.x&&h.y===food.y){score+=10;place();document.getElementById('gameScore').textContent='Score: '+score;}
    else snake.pop();
    ctx.fillStyle='#0f0a2a';ctx.fillRect(0,0,cv.width,cv.height);
    ctx.fillStyle='#ef4444';ctx.fillRect(food.x*sz,food.y*sz,sz-2,sz-2);
    ctx.fillStyle='#22c55e';snake.forEach(s=>ctx.fillRect(s.x*sz,s.y*sz,sz-2,sz-2));
  },spd);
},
g3(el){
  const icons=['🎮','🎲','🎯','🎪','🎭','🎨','🎬','🎤'];
  let cards=[...icons,...icons].sort(()=>Math.random()-.5),flipped=[],matched=0,moves=0;
  el.innerHTML='<p id="memMsg">Moves: 0</p><div class="mem-board" style="display:grid;grid-template-columns:repeat(4,65px);gap:8px;justify-content:center"></div>';
  const bd=el.querySelector('.mem-board');
  cards.forEach((ic,i)=>{
    const c=document.createElement('div');
    c.style.cssText='width:65px;height:65px;background:#1e1b4b;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;border:2px solid #7c3aed';
    c.dataset.i=i;c.textContent='?';
    c.onclick=()=>{
      if(flipped.length>=2||c.dataset.done||flipped.includes(c))return;
      c.textContent=ic;flipped.push(c);
      if(flipped.length===2){
        moves++;el.querySelector('#memMsg').textContent='Moves: '+moves;
        if(flipped[0].textContent===flipped[1].textContent){flipped.forEach(f=>f.dataset.done='1');matched+=2;flipped=[];if(matched===16)document.getElementById('gameScore').textContent='You won in '+moves+' moves!';}
        else setTimeout(()=>{flipped.forEach(f=>{if(!f.dataset.done)f.textContent='?';});flipped=[];},800);
      }
    };
    bd.appendChild(c);
  });
},
g4(el){
  let score=0,time=30;
  el.innerHTML=`<p id="whkMsg">Score: 0 | Time: ${time}</p><div style="display:grid;grid-template-columns:repeat(3,80px);gap:10px;justify-content:center"></div>`;
  const bd=el.querySelector('div');
  for(let i=0;i<9;i++){const h=document.createElement('div');h.style.cssText='width:80px;height:80px;background:#1e1b4b;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:36px;cursor:pointer';h.dataset.i=i;bd.appendChild(h);}
  const holes=bd.children;
  function pop(){
    Array.from(holes).forEach(h=>h.textContent='');
    const r=Math.floor(Math.random()*9);
    holes[r].textContent='🐹';
    holes[r].onclick=()=>{score++;holes[r].textContent='💥';el.querySelector('#whkMsg').textContent='Score: '+score+' | Time: '+time;setTimeout(()=>holes[r].textContent='',200);};
  }
  const gi=setInterval(pop,800);
  const ti=setInterval(()=>{time--;el.querySelector('#whkMsg').textContent='Score: '+score+' | Time: '+time;if(time<=0){clearInterval(gi);clearInterval(ti);document.getElementById('gameScore').textContent='Final Score: '+score;}},1000);
  gameLoop=gi;
},
g5(el){
  const colors=['red','blue','green','yellow','purple','orange'];
  let score=0,round=0;
  function next(){
    round++;if(round>10){document.getElementById('gameScore').textContent='Final: '+score+'/10';return;}
    const txt=colors[Math.floor(Math.random()*colors.length)];
    const col=colors[Math.floor(Math.random()*colors.length)];
    el.innerHTML=`<p>Round ${round}/10 | Score: ${score}</p><p style="font-size:48px;color:${col};text-align:center">${txt.toUpperCase()}</p><p>What COLOR is the text?</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div>`;
    const bd=el.querySelector('div');
    colors.forEach(c=>{const b=document.createElement('button');b.style.cssText=`padding:12px 20px;background:${c};border:none;border-radius:8px;cursor:pointer;font-size:16px`;b.onclick=()=>{if(c===col)score++;next();};bd.appendChild(b);});
  }
  next();
},
g6(el){
  let start,waiting=false;
  el.innerHTML='<div id="rxBox" style="width:280px;height:280px;background:#ef4444;border-radius:20px;display:flex;align-items:center;justify-content:center;margin:auto;cursor:pointer;font-size:20px;color:white;text-align:center;padding:20px">Wait for green...</div>';
  const box=el.querySelector('#rxBox');
  const t=setTimeout(()=>{box.style.background='#22c55e';box.textContent='TAP NOW!';start=Date.now();waiting=true;},2000+Math.random()*3000);
  box.onclick=()=>{
    if(!waiting){clearTimeout(t);box.style.background='#ef4444';box.textContent='Too early! Tap to retry';waiting=false;setTimeout(()=>{box.style.background='#ef4444';box.textContent='Wait for green...';const t2=setTimeout(()=>{box.style.background='#22c55e';box.textContent='TAP NOW!';start=Date.now();waiting=true;},2000+Math.random()*3000);},1000);return;}
    const ms=Date.now()-start;
    document.getElementById('gameScore').textContent=ms+'ms';
    box.style.background='#3b82f6';box.textContent=ms+'ms! Tap to retry';waiting=false;
  };
},
g7(el){
  const target=Math.floor(Math.random()*100)+1;let tries=0;
  el.innerHTML='<p>Guess a number 1-100</p><input id="guessIn" type="number" min="1" max="100" style="padding:10px;font-size:20px;width:100px;text-align:center"><br><br><button class="btn-primary" onclick="window._guess()">Guess</button><p id="guessMsg"></p>';
  window._guess=()=>{
    tries++;const v=parseInt(document.getElementById('guessIn').value);
    if(v===target){document.getElementById('guessMsg').textContent='🎉 Correct in '+tries+' tries!';document.getElementById('gameScore').textContent='Tries: '+tries;}
    else if(v<target)document.getElementById('guessMsg').textContent='Too low!';
    else document.getElementById('guessMsg').textContent='Too high!';
  };
},
g8(el){
  const opts=['rock','paper','scissors'];const em={rock:'✊',paper:'🖐',scissors:'✌️'};
  let w=0,l=0;
  el.innerHTML='<p id="rpsMsg">Choose your weapon!</p><div style="display:flex;gap:15px;justify-content:center" id="rpsBtns"></div><p id="rpsScore"></p>';
  const bd=el.querySelector('#rpsBtns');
  opts.forEach(o=>{const b=document.createElement('button');b.style.cssText='font-size:40px;padding:15px;background:#1e1b4b;border:2px solid #7c3aed;border-radius:12px;cursor:pointer';b.textContent=em[o];b.onclick=()=>{
    const ai=opts[Math.floor(Math.random()*3)];
    let r='Draw';if((o==='rock'&&ai==='scissors')||(o==='paper'&&ai==='rock')||(o==='scissors'&&ai==='paper')){r='You win!';w++;}else if(o!==ai){r='You lose!';l++;}
    el.querySelector('#rpsMsg').textContent=`${em[o]} vs ${em[ai]} — ${r}`;
    el.querySelector('#rpsScore').textContent=`W:${w} L:${l}`;
  };bd.appendChild(b);});
},
g9(el){
  const qs=[{q:'Capital of Nigeria?',a:['Lagos','Abuja','Kano'],c:1},{q:'2+2×2=?',a:['8','6','4'],c:1},{q:'Largest planet?',a:['Saturn','Jupiter','Mars'],c:1},{q:'HTML stands for?',a:['HyperText Markup Language','High Tech Modern Language','Home Tool Markup Language'],c:0},{q:'Fastest land animal?',a:['Lion','Cheetah','Horse'],c:1}];
  let i=0,sc=0;
  function show(){
    if(i>=qs.length){document.getElementById('gameScore').textContent='Score: '+sc+'/'+qs.length;return;}
    const q=qs[i];
    el.innerHTML=`<p>Q${i+1}/${qs.length}: ${q.q}</p><div id="quizOpts"></div>`;
    const bd=el.querySelector('#quizOpts');
    q.a.forEach((a,j)=>{const b=document.createElement('button');b.style.cssText='display:block;width:100%;padding:12px;margin:5px 0;background:#1e1b4b;color:white;border:2px solid #7c3aed;border-radius:8px;cursor:pointer;font-size:16px;text-align:left';b.textContent=a;b.onclick=()=>{if(j===q.c)sc++;i++;show();};bd.appendChild(b);});
  }
  show();
},
g10(el){
  const cv=document.createElement('canvas');cv.width=300;cv.height=400;cv.style.cssText='border:2px solid #7c3aed;border-radius:8px;display:block;margin:auto;background:#0f172a';el.appendChild(cv);
  const ctx=cv.getContext('2d');let bird={y:200,v:0},pipes=[],sc=0,frame=0,dead=false;
  function addPipe(){pipes.push({x:300,gap:Math.random()*100+80,w:40});}
  addPipe();
  cv.onclick=()=>{if(dead)return;bird.v=-6;};
  el.innerHTML+='<p style="text-align:center">Tap to jump!</p>';
  gameLoop=setInterval(()=>{
    if(dead)return;
    bird.v+=0.3;bird.y+=bird.v;frame++;
    if(frame%90===0)addPipe();
    pipes.forEach(p=>{p.x-=2;});
    pipes=pipes.filter(p=>p.x>-50);
    ctx.fillStyle='#0f172a';ctx.fillRect(0,0,300,400);
    ctx.fillStyle='#22c55e';
    pipes.forEach(p=>{ctx.fillRect(p.x,0,p.w,p.gap);ctx.fillRect(p.x,p.gap+100,p.w,400);
      if(20>p.x&&20<p.x+p.w&&(bird.y<p.gap||bird.y>p.gap+100))dead=true;
      if(p.x===18)sc++;
    });
    ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(20,bird.y,12,0,Math.PI*2);ctx.fill();
    if(bird.y>400||bird.y<0)dead=true;
    if(dead){clearInterval(gameLoop);document.getElementById('gameScore').textContent='Score: '+sc;}
    ctx.fillStyle='white';ctx.font='20px Arial';ctx.fillText('Score: '+sc,10,30);
  },30);
},
g11(el){
  const cv=document.createElement('canvas');cv.width=300;cv.height=400;cv.style.cssText='border:2px solid #7c3aed;border-radius:8px;display:block;margin:auto;background:#0f0a2a';el.appendChild(cv);
  const ctx=cv.getContext('2d');let py=170,ay=170,bx=150,by=200,bdx=3,bdy=2,sc=0;
  cv.onmousemove=e=>{const r=cv.getBoundingClientRect();py=e.clientY-r.top-25;};
  cv.ontouchmove=e=>{const r=cv.getBoundingClientRect();py=e.touches[0].clientY-r.top-25;};
  gameLoop=setInterval(()=>{
    bx+=bdx;by+=bdy;
    if(by<=0||by>=390)bdy=-bdy;
    ay+=(by-ay-25)*0.05;
    if(bx<=15&&by>=py&&by<=py+50){bdx=Math.abs(bdx);sc++;}
    if(bx>=280&&by>=ay&&by<=ay+50)bdx=-Math.abs(bdx);
    if(bx<0||bx>300){bx=150;by=200;bdx=3*(Math.random()>.5?1:-1);}
    ctx.fillStyle='#0f0a2a';ctx.fillRect(0,0,300,400);
    ctx.fillStyle='#7c3aed';ctx.fillRect(5,py,10,50);ctx.fillRect(285,ay,10,50);
    ctx.fillStyle='white';ctx.beginPath();ctx.arc(bx,by,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='white';ctx.font='16px Arial';ctx.fillText('Score: '+sc,120,20);
    document.getElementById('gameScore').textContent='Score: '+sc;
  },20);
},
g12(el){
  const cv=document.createElement('canvas');cv.width=300;cv.height=400;cv.style.cssText='border:2px solid #7c3aed;border-radius:8px;display:block;margin:auto;background:#0f0a2a';el.appendChild(cv);
  const ctx=cv.getContext('2d');let px=120,bx=150,by=350,bdx=2,bdy=-2,bricks=[],sc=0;
  for(let r=0;r<4;r++)for(let c=0;c<6;c++)bricks.push({x:c*50+2,y:r*20+30,w:46,h:16,alive:true});
  cv.onmousemove=e=>{const r=cv.getBoundingClientRect();px=e.clientX-r.left-25;};
  cv.ontouchmove=e=>{const r=cv.getBoundingClientRect();px=e.touches[0].clientX-r.left-25;};
  gameLoop=setInterval(()=>{
    bx+=bdx;by+=bdy;
    if(bx<=5||bx>=295)bdx=-bdx;
    if(by<=5)bdy=-bdy;
    if(by>=385&&bx>=px&&bx<=px+50)bdy=-Math.abs(bdy);
    if(by>400){clearInterval(gameLoop);document.getElementById('gameScore').textContent='Game Over! Score: '+sc;return;}
    bricks.forEach(b=>{if(b.alive&&bx>=b.x&&bx<=b.x+b.w&&by>=b.y&&by<=b.y+b.h){b.alive=false;bdy=-bdy;sc+=10;}});
    ctx.fillStyle='#0f0a2a';ctx.fillRect(0,0,300,400);
    bricks.forEach(b=>{if(b.alive){ctx.fillStyle='#7c3aed';ctx.fillRect(b.x,b.y,b.w,b.h);}});
    ctx.fillStyle='#22c55e';ctx.fillRect(px,390,50,8);
    ctx.fillStyle='white';ctx.beginPath();ctx.arc(bx,by,5,0,Math.PI*2);ctx.fill();
    document.getElementById('gameScore').textContent='Score: '+sc;
  },15);
},
g13(el){
  let grid=Array(16).fill(0);
  function add(){const e=grid.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(e.length)grid[e[Math.floor(Math.random()*e.length)]]=Math.random()<.9?2:4;}
  add();add();
  function render(){
    el.innerHTML='<div style="display:grid;grid-template-columns:repeat(4,65px);gap:5px;justify-content:center"></div><p style="text-align:center">Use arrow keys or swipe</p>';
    const bd=el.querySelector('div');
    const cols={0:'#1e1b4b',2:'#3b82f6',4:'#22c55e',8:'#f59e0b',16:'#ef4444',32:'#ec4899',64:'#8b5cf6',128:'#facc15',256:'#14b8a6',512:'#f97316',1024:'#e11d48',2048:'#7c3aed'};
    grid.forEach(v=>{const c=document.createElement('div');c.style.cssText=`width:65px;height:65px;background:${cols[v]||'#7c3aed'};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:${v>99?'16':'22'}px;font-weight:bold;color:white`;c.textContent=v||'';bd.appendChild(c);});
  }
  function move(dir){
    let moved=false;
    const rot=(g,t)=>{let n=[...g];for(let i=0;i<t;i++){let r=Array(16).fill(0);for(let y=0;y<4;y++)for(let x=0;x<4;x++)r[x*4+(3-y)]=n[y*4+x];n=r;}return n;};
    let g=rot(grid,dir);
    for(let r=0;r<4;r++){
      let row=[g[r*4],g[r*4+1],g[r*4+2],g[r*4+3]].filter(v=>v);
      for(let i=0;i<row.length-1;i++)if(row[i]===row[i+1]){row[i]*=2;row.splice(i+1,1);}
      while(row.length<4)row.push(0);
      for(let c=0;c<4;c++)if(g[r*4+c]!==row[c])moved=true;
      g[r*4]=row[0];g[r*4+1]=row[1];g[r*4+2]=row[2];g[r*4+3]=row[3];
    }
    grid=rot(g,(4-dir)%4);
    if(moved){add();render();}
  }
  document.onkeydown=e=>{if(e.key==='ArrowLeft')move(0);if(e.key==='ArrowUp')move(1);if(e.key==='ArrowRight')move(2);if(e.key==='ArrowDown')move(3);};
  render();
},
g14(el){
  const sz=8,mines=10;let grid=Array(sz*sz).fill(0),revealed=Array(sz*sz).fill(false),over=false;
  let placed=0;while(placed<mines){const i=Math.floor(Math.random()*sz*sz);if(grid[i]!==-1){grid[i]=-1;placed++;}}
  for(let i=0;i<sz*sz;i++)if(grid[i]!==-1){let c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const ny=Math.floor(i/sz)+dy,nx=i%sz+dx;if(ny>=0&&ny<sz&&nx>=0&&nx<sz&&grid[ny*sz+nx]===-1)c++;}grid[i]=c;}
  function render(){
    el.innerHTML='<div style="display:grid;grid-template-columns:repeat('+sz+',35px);gap:2px;justify-content:center"></div>';
    const bd=el.querySelector('div');
    for(let i=0;i<sz*sz;i++){
      const c=document.createElement('div');
      c.style.cssText=`width:35px;height:35px;background:${revealed[i]?(grid[i]===-1?'#ef4444':'#1e1b4b'):'#3b82f6'};border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;color:white;font-weight:bold`;
      c.textContent=revealed[i]?(grid[i]===-1?'💣':grid[i]||''):'?';
      c.onclick=()=>{
        if(over||revealed[i])return;
        revealed[i]=true;
        if(grid[i]===-1){over=true;for(let j=0;j<sz*sz;j++)revealed[j]=true;document.getElementById('gameScore').textContent='💥 Boom!';render();return;}
        if(grid[i]===0){const q=[i];while(q.length){const cur=q.shift();for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const ny=Math.floor(cur/sz)+dy,nx=cur%sz+dx;if(ny>=0&&ny<sz&&nx>=0&&nx<sz){const ni=ny*sz+nx;if(!revealed[ni]){revealed[ni]=true;if(grid[ni]===0)q.push(ni);}}}}}
        render();
      };
      bd.appendChild(c);
    }
  }
  render();
},
g15(el){
  const words=['JAVASCRIPT','PYTHON','GITHUB','RENDER','VIBEHUB','PREMIUM','LEADER','SOCIAL','MOBILE','SERVER'];
  let i=0,sc=0;
  function show(){
    if(i>=words.length){document.getElementById('gameScore').textContent='Score: '+sc+'/'+words.length;return;}
    const w=words[i],s=w.split('').sort(()=>Math.random()-.5).join('');
    el.innerHTML=`<p>Unscramble: <strong style="font-size:28px;color:#facc15">${s}</strong></p><input id="scramIn" style="padding:10px;font-size:20px;text-align:center;text-transform:uppercase" placeholder="Your answer"><br><br><button class="btn-primary" onclick="window._scram()">Check</button><p id="scramMsg"></p>`;
    window._scram=()=>{
      const a=document.getElementById('scramIn').value.trim().toUpperCase();
      if(a===w){sc++;el.querySelector('#scramMsg').textContent='✅ Correct!';setTimeout(()=>{i++;show();},800);}
      else el.querySelector('#scramMsg').textContent='❌ Try again!';
    };
  }
  show();
},
g16(el){
  el.innerHTML='<p style="text-align:center;font-size:48px">♟️</p><p style="text-align:center">Chess Lite — Coming in next update!</p><p style="text-align:center;color:#a78bfa">Premium game unlocked!</p>';
},
g17(el){
  const cv=document.createElement('canvas');cv.width=300;cv.height=400;cv.style.cssText='border:2px solid #7c3aed;border-radius:8px;display:block;margin:auto;background:#0f0a2a';el.appendChild(cv);
  const ctx=cv.getContext('2d');let px=130,bullets=[],aliens=[],sc=0,frame=0;
  for(let r=0;r<3;r++)for(let c=0;c<6;c++)aliens.push({x:c*45+15,y:r*30+20,alive:true});
  cv.onmousemove=e=>{const r=cv.getBoundingClientRect();px=e.clientX-r.left-15;};
  cv.ontouchmove=e=>{const r=cv.getBoundingClientRect();px=e.touches[0].clientX-r.left-15;};
  cv.onclick=()=>bullets.push({x:px+12,y:370});
  gameLoop=setInterval(()=>{
    frame++;
    bullets.forEach(b=>b.y-=5);bullets=bullets.filter(b=>b.y>0);
    aliens.forEach(a=>{if(a.alive)a.x+=Math.sin(frame*0.02)*1;});
    bullets.forEach(b=>{aliens.forEach(a=>{if(a.alive&&b.x>=a.x&&b.x<=a.x+25&&b.y>=a.y&&b.y<=a.y+20){a.alive=false;b.y=-10;sc+=10;}});});
    ctx.fillStyle='#0f0a2a';ctx.fillRect(0,0,300,400);
    ctx.fillStyle='#22c55e';ctx.fillRect(px,375,30,15);
    ctx.fillStyle='#facc15';bullets.forEach(b=>ctx.fillRect(b.x,b.y,3,10));
    ctx.fillStyle='#ef4444';aliens.forEach(a=>{if(a.alive)ctx.fillRect(a.x,a.y,25,18);});
    ctx.fillStyle='white';ctx.font='14px Arial';ctx.fillText('Score: '+sc,10,395);
    document.getElementById('gameScore').textContent='Score: '+sc;
  },25);
},
g18(el){
  const cv=document.createElement('canvas');cv.width=200;cv.height=400;cv.style.cssText='border:2px solid #7c3aed;border-radius:8px;display:block;margin:auto;background:#0f0a2a';el.appendChild(cv);
  const ctx=cv.getContext('2d');const cols=10,rows=20,sz=20;let board=Array(rows).map(()=>Array(cols).fill(0)),score=0;
  const shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]]];
  let cur,cx,cy;
  function spawn(){cur=shapes[Math.floor(Math.random()*shapes.length)];cx=3;cy=0;}
  spawn();
  document.onkeydown=e=>{
    if(e.key==='ArrowLeft'&&cx>0)cx--;
    if(e.key==='ArrowRight'&&cx<cols-cur[0].length)cx++;
    if(e.key==='ArrowDown')cy++;
  };
  gameLoop=setInterval(()=>{
    cy++;
    if(cy+cur.length>=rows){
      cur.forEach((r,dy)=>r.forEach((v,dx)=>{if(v&&cy+dy<rows)board[cy+dy][cx+dx]=1;}));
      for(let r=rows-1;r>=0;r--)if(board[r].every(v=>v)){board.splice(r,1);board.unshift(Array(cols).fill(0));score+=100;}
      spawn();
      if(board[0].some(v=>v)){clearInterval(gameLoop);document.getElementById('gameScore').textContent='Game Over! Score: '+score;}
    }
    ctx.fillStyle='#0f0a2a';ctx.fillRect(0,0,200,400);
    ctx.fillStyle='#3b82f6';
    board.forEach((r,y)=>r.forEach((v,x)=>{if(v)ctx.fillRect(x*sz,y*sz,sz-1,sz-1);}));
    ctx.fillStyle='#22c55e';
    cur.forEach((r,dy)=>r.forEach((v,dx)=>{if(v)ctx.fillRect((cx+dx)*sz,(cy+dy)*sz,sz-1,sz-1);}));
    document.getElementById('gameScore').textContent='Score: '+score;
  },500);
},
g19(el){
  el.innerHTML='<p style="text-align:center;font-size:48px">🟡</p><p style="text-align:center">Pac Dash — Coming in next update!</p><p style="text-align:center;color:#a78bfa">Premium game unlocked!</p>';
},
g20(el){
  el.innerHTML='<p style="text-align:center;font-size:48px">🏰</p><p style="text-align:center">Tower Defense — Coming in next update!</p><p style="text-align:center;color:#a78bfa">Premium game unlocked!</p>';
},
g21(el){
  const cv=document.createElement('canvas');cv.width=300;cv.height=400;cv.style.cssText='border:2px solid #7c3aed;border-radius:8px;display:block;margin:auto;background:#1a1a2e';el.appendChild(cv);
  const ctx=cv.getContext('2d');let px=130,obs=[],sc=0,frame=0;
  cv.onmousemove=e=>{const r=cv.getBoundingClientRect();px=e.clientX-r.left-15;};
  cv.ontouchmove=e=>{const r=cv.getBoundingClientRect();px=e.touches[0].clientX-r.left-15;};
  gameLoop=setInterval(()=>{
    frame++;sc++;
    if(frame%30===0)obs.push({x:Math.random()*260,y:-30,w:30,h:30});
    obs.forEach(o=>o.y+=4);obs=obs.filter(o=>o.y<420);
    const hit=obs.some(o=>px<o.x+o.w&&px+30>o.x&&350<o.y+o.h&&380>o.y);
    if(hit){clearInterval(gameLoop);document.getElementById('gameScore').textContent='Crash! Score: '+Math.floor(sc/10);return;}
    ctx.fillStyle='#1a1a2e';ctx.fillRect(0,0,300,400);
    ctx.fillStyle='#333';ctx.fillRect(120,0,4,400);ctx.fillRect(180,0,4,400);
    ctx.fillStyle='#ef4444';obs.forEach(o=>ctx.fillRect(o.x,o.y,o.w,o.h));
    ctx.fillStyle='#3b82f6';ctx.fillRect(px,360,30,20);
    ctx.fillStyle='white';ctx.font='14px Arial';ctx.fillText('Score: '+Math.floor(sc/10),10,20);
  },25);
},
g22(el){
  let hp=100,ehp=100;
  function render(){
    el.innerHTML=`<div style="text-align:center"><p>🥊 Fight Club</p><p>Enemy HP: <span style="color:red">${ehp}</span></p><div style="width:200px;height:20px;background:#333;margin:auto;border-radius:10px"><div style="width:${ehp*2}px;height:20px;background:#ef4444;border-radius:10px"></div></div><br><p>Your HP: <span style="color:green">${hp}</span></p><div style="width:200px;height:20px;background:#333;margin:auto;border-radius:10px"><div style="width:${hp*2}px;height:20px;background:#22c55e;border-radius:10px"></div></div><br><button class="btn-primary" onclick="window._punch()">👊 Punch</button> <button class="btn-primary" onclick="window._kick()">🦵 Kick</button> <button class="btn-primary" onclick="window._block()">🛡 Block</button><p id="fightMsg"></p></div>`;
  }
  window._punch=()=>{const d=10+Math.floor(Math.random()*15);ehp=Math.max(0,ehp-d);const ed=5+Math.floor(Math.random()*10);hp=Math.max(0,hp-ed);el.querySelector('#fightMsg').textContent=`You dealt ${d} dmg, took ${ed}!`;check();render();};
  window._kick=()=>{const d=15+Math.floor(Math.random()*20);ehp=Math.max(0,ehp-d);const ed=8+Math.floor(Math.random()*12);hp=Math.max(0,hp-ed);el.querySelector('#fightMsg').textContent=`Kick ${d} dmg, took ${ed}!`;check();render();};
  window._block=()=>{const ed=Math.floor(Math.random()*5);hp=Math.max(0,hp-ed);el.querySelector('#fightMsg').textContent=`Blocked! Took only ${ed}`;check();render();};
  function check(){if(ehp<=0)document.getElementById('gameScore').textContent='🏆 You win!';if(hp<=0)document.getElementById('gameScore').textContent='💀 You lost!';}
  render();
},
g23(el){
  let hp=100,mp=50,ehp=150;
  function render(){
    el.innerHTML=`<div style="text-align:center"><p>⚔️ RPG Battle</p><p>🐉 Dragon HP: <span style="color:red">${ehp}</span></p><p>❤️ HP: ${hp} | 💎 MP: ${mp}</p><button class="btn-primary" onclick="window._atk()">⚔️ Attack</button> <button class="btn-primary" onclick="window._mag()">🔥 Magic (20MP)</button> <button class="btn-primary" onclick="window._heal()">💚 Heal (15MP)</button><p id="rpgMsg"></p></div>`;
  }
  window._atk=()=>{const d=10+Math.floor(Math.random()*10);ehp-=d;const ed=5+Math.floor(Math.random()*8);hp-=ed;el.querySelector('#rpgMsg').textContent=`Hit ${d}! Dragon hits ${ed}`;check();render();};
  window._mag=()=>{if(mp<20){el.querySelector('#rpgMsg').textContent='Not enough MP!';return;}mp-=20;const d=25+Math.floor(Math.random()*15);ehp-=d;el.querySelector('#rpgMsg').textContent=`🔥 Fireball ${d} dmg!`;check();render();};
  window._heal=()=>{if(mp<15){el.querySelector('#rpgMsg').textContent='Not enough MP!';return;}mp-=15;hp=Math.min(100,hp+30);el.querySelector('#rpgMsg').textContent='💚 Healed 30 HP!';check();render();};
  function check(){if(ehp<=0)document.getElementById('gameScore').textContent='🏆 Dragon slain!';if(hp<=0)document.getElementById('gameScore').textContent='💀 Defeated!';}
  render();
}
};

async function loadChatRooms(){
  const d=await api('/api/chat/rooms');
  const el=document.getElementById('chatRooms');
  if(!d.rooms||!d.rooms.length){el.innerHTML='<p class="empty">No rooms yet</p>';return;}
  el.innerHTML=d.rooms.map(r=>`<div class="chat-room-card" onclick="openChat('${r.name}')"><strong>${r.name}</strong><span>${r.count||0} online</span></div>`).join('');
}

async function openChat(name){
  currentRoom=name;
  document.getElementById('chatModal').style.display='flex';
  document.getElementById('chatRoomName').textContent=name;
  const d=await api('/api/chat/messages?room='+name);
  const el=document.getElementById('chatMessages');
  if(!d.messages||!d.messages.length){el.innerHTML='<p class="empty">No messages yet</p>';return;}
  el.innerHTML=d.messages.map(m=>`<div class="chat-msg"><strong>${m.username}</strong>: ${m.text}</div>`).join('');
  el.scrollTop=el.scrollHeight;
}

function closeChat(){document.getElementById('chatModal').style.display='none';currentRoom=null;}

async function sendMessage(){
  const inp=document.getElementById('chatInput');
  const t=inp.value.trim();
  if(!t||!currentRoom)return;
  await api('/api/chat/send',{method:'POST',body:JSON.stringify({room:currentRoom,text:t})});
  inp.value='';
  openChat(currentRoom);
}

async function loadLeaderboard(){
  const d=await api('/api/leaderboard');
  const el=document.getElementById('leaderList');
  if(!d.users||!d.users.length){el.innerHTML='<p class="empty">No data yet</p>';return;}
  el.innerHTML=d.users.map((u,i)=>`<div class="leader-row"><span class="rank">${i+1}</span><span>${u.username}</span><span>⭐ ${u.xp||0} XP</span></div>`).join('');
}

async function loadProfile(){
  const d=await api('/api/profile');
  const el=document.getElementById('profileInfo');
  el.innerHTML=`<div class="profile-card"><h3>${d.username||'User'}</h3><p>⭐ XP: ${d.xp||0}</p><p>💰 Coins: ${d.coins||0}</p><p>${d.premium?'⭐ Premium Member':'Free Member'}</p></div>`;
}

async function buyPremium(){
  if(currentUser&&currentUser.premium){alert('Already premium!');return;}
  const ok=confirm('Go Premium for ₦2,500/month?');
  if(!ok)return;
  const d=await api('/api/premium',{method:'POST'});
  if(d.success){alert('🎉 Premium activated!');boot();}
  else alert(d.error||'Payment failed');
}

async function loadAdmin(){
  const d=await api('/api/admin/stats');
  const el=document.getElementById('adminStats');
  if(d.error){el.innerHTML='<p>'+d.error+'</p>';return;}
  el.innerHTML=`<div class="admin-card"><h3>💰 Total Earnings: ₦${(d.total||0).toLocaleString()}</h3><p>Signups: ₦${(d.signup_earn||0).toLocaleString()} (${d.signup_count||0})</p><p>Logins: ₦${(d.login_earn||0).toLocaleString()}</p><p>Posts: ₦${(d.post_earn||0).toLocaleString()}</p><p>Games: ₦${(d.game_earn||0).toLocaleString()}</p><p>Chat: ₦${(d.chat_earn||0).toLocaleString()}</p><p>Premium: ₦${(d.premium_earn||0).toLocaleString()}</p><p>Users: ${d.user_count||0}</p></div>`;
}

async function doWithdraw(){
  const amt=prompt('Enter amount to withdraw (₦):');
  if(!amt)return;
  const d=await api('/api/admin/withdraw',{method:'POST',body:JSON.stringify({amount:parseFloat(amt)})});
  alert(d.success?'✅ Withdrawal requested!':d.error||'Failed');
  loadAdmin();
}

if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js');

document.addEventListener('DOMContentLoaded',()=>{
  const t=localStorage.getItem('vh_token');
  if(t)boot();
});

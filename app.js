let cardDB={};let hp=20,advNow=0,advTotal=12;

async function loadDatabase(){
  const res=await fetch('./cards.json',{cache:'no-store'});
  if(!res.ok) throw new Error('cards.json 載入失敗');
  const data=await res.json();
  cardDB=data.cards||{};
  const card=new URLSearchParams(location.search).get('card');
  if(card){document.getElementById('cardCode').value=card.toUpperCase();identifyCard();}
}

function startGame(){
  const n=parseInt(document.getElementById('adventureTotal').value,10);
  if(!Number.isFinite(n)||n<1){alert('冒險卡數量至少 1 張');return;}
  advTotal=n;hp=20;advNow=0;
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('advTotalText').textContent=advTotal;
  updateUI();
}

function updateUI(){
  document.getElementById('hpText').textContent=hp;
  document.getElementById('advNowText').textContent=advNow;
  document.getElementById('hpfill').style.width=(hp/20*100)+'%';
  document.getElementById('progressfill').style.width=(Math.min(advNow/advTotal,1)*100)+'%';
  if(hp<=0) document.getElementById('result').innerHTML='<h2>💀 不老村生命歸零</h2><p>本局失敗。</p>';
  if(advNow>=advTotal&&hp>0) document.getElementById('result').innerHTML='<h2>👑 冒險完成</h2><p>已達成本局冒險卡數量，可以進入最終魔王戰。</p>';
}

function changeHp(n){hp=Math.max(0,Math.min(20,hp+n));updateUI();}
function finishAdventure(){if(advNow<advTotal)advNow++;updateUI();}

function normalizeCode(raw){
  raw=(raw||'').trim().toUpperCase();
  try{if(/^https?:\/\//i.test(raw)){const u=new URL(raw);raw=(u.searchParams.get('card')||'').toUpperCase();}}catch(e){}
  return raw.replace(/\s+/g,'');
}

function identifyCard(){
  const input=document.getElementById('cardCode');
  const code=normalizeCode(input.value);input.value=code;
  if(!/^[KMFEBRL]\d{3}$/.test(code)){renderError('卡號格式錯誤','請輸入例如 K001、M001。');return;}
  const c=cardDB[code];
  if(!c){renderError('查無卡牌',`${code} 尚未加入 cards.json。`);return;}
  renderCard(code,c);
}

function renderError(title,msg){document.getElementById('result').innerHTML=`<h2>⚠️ ${title}</h2><p>${msg}</p>`;}

function renderCard(code,c){
  const r=document.getElementById('result');
  if(c.type==='knowledge'){
    r.innerHTML=`<span class="tag">知識卡</span><span class="tag">${code}</span><h2>📖 ${c.name}</h2><p>${c.question}</p><div class="controls">${c.options.map((o,i)=>`<button onclick="answerKnowledge('${code}','${String.fromCharCode(65+i)}')">${o}</button>`).join('')}</div>`;
  }else if(c.type==='monster'){
    r.innerHTML=`<span class="tag">怪獸卡</span><span class="tag">${code}</span><h2>⚔️ ${c.name}</h2><p>❤️ HP：<b>${c.hp}</b></p><p>⚔️ ATK：<b>${c.atk}</b></p><p>🎯 弱點：<b>${c.weak}</b></p>`;
  }else if(c.type==='fate'){
    r.innerHTML=`<span class="tag">命運卡</span><span class="tag">${code}</span><h2>🃏 ${c.name}</h2><p><b>${c.effect}</b></p><button onclick="applyFate('${code}')">執行效果</button>`;
  }else if(c.type==='equipment'){
    r.innerHTML=`<span class="tag">裝備卡</span><span class="tag">${code}</span><h2>🎁 ${c.name}</h2><p>類型：${c.category}</p><p>動作：<b>${c.move}</b></p><p>效果：${c.effect}</p>`;
  }else if(c.type==='boss'){
    r.innerHTML=`<span class="tag">魔王卡</span><span class="tag">${code}</span><h2>👑 ${c.name}</h2><p>第 ${c.stage} 階段</p><p>${c.effect}</p>`;
  }else{r.innerHTML=`<span class="tag">${code}</span><h2>${c.name||'卡牌'}</h2>`;}
}

function answerKnowledge(code,choice){
  const c=cardDB[code];const ok=choice===c.answer;
  changeHp(ok?2:-2);
  document.getElementById('result').innerHTML=`<h2>${ok?'✅ 回答正確':'❌ 回答錯誤'}</h2><p>${ok?'':'正確答案：<b>'+c.answer+'</b><br>'}${c.teach}</p><p>${ok?'❤️ +2 HP':'💔 -2 HP'}</p><button onclick="finishAdventure()">完成此冒險</button>`;
}

function applyFate(code){const c=cardDB[code];changeHp(c.hpChange||0);document.getElementById('result').innerHTML+=`<p><b>已結算：${c.effect}</b></p><button onclick="finishAdventure()">完成此冒險</button>`;}

document.addEventListener('DOMContentLoaded',()=>{loadDatabase().catch(e=>renderError('資料庫載入失敗',e.message));});
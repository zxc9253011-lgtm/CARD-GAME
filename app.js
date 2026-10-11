let cardDB={};
let hp=20,advNow=0,advTotal=12,playerCount=4;
let battle=null;
let pendingCardCode='';

async function loadDatabase(){
  const res=await fetch('./cards.json',{cache:'no-store'});
  if(!res.ok) throw new Error('cards.json 載入失敗');
  const data=await res.json();
  cardDB=data.cards||{};

  // 掃 QR 進站時先記住卡號，不在「尚未開始遊戲」時啟動戰鬥。
  const card=new URLSearchParams(location.search).get('card');
  if(card){
    pendingCardCode=normalizeCode(card);
    document.getElementById('cardCode').value=pendingCardCode;
  }
}

function startGame(){
  const n=parseInt(document.getElementById('adventureTotal').value,10);
  if(!Number.isFinite(n)||n<1){alert('冒險卡數量至少 1 張');return;}

  advTotal=n;
  playerCount=parseInt(document.getElementById('players').value,10)||4;
  hp=20;
  advNow=0;
  battle=null;

  document.getElementById('setup').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('advTotalText').textContent=advTotal;
  updateUI();

  // 如果玩家是掃卡進入網站，開局後再正式載入該卡。
  const code=normalizeCode(document.getElementById('cardCode').value||pendingCardCode);
  if(code){
    document.getElementById('cardCode').value=code;
    identifyCard();
  }
}

function updateUI(){
  document.getElementById('hpText').textContent=hp;
  document.getElementById('advNowText').textContent=advNow;
  document.getElementById('hpfill').style.width=(hp/20*100)+'%';
  document.getElementById('progressfill').style.width=(Math.min(advNow/advTotal,1)*100)+'%';

  if(hp<=0){
    battle=null;
    document.getElementById('result').innerHTML='<h2>💀 不老村生命歸零</h2><p>本局失敗。</p>';
  }

  if(advNow>=advTotal&&hp>0&&!battle){
    document.getElementById('result').innerHTML='<h2>👑 冒險完成</h2><p>已達成本局冒險卡數量，可以進入最終魔王戰。</p>';
  }
}

function changeHp(n){
  hp=Math.max(0,Math.min(20,hp+n));
  updateUI();
}

function finishAdventure(){
  if(advNow<advTotal)advNow++;
  battle=null;
  updateUI();
}

function normalizeCode(raw){
  raw=(raw||'').trim().toUpperCase();
  try{
    if(/^https?:\/\//i.test(raw)){
      const u=new URL(raw);
      raw=(u.searchParams.get('card')||'').toUpperCase();
    }
  }catch(e){}
  return raw.replace(/\s+/g,'');
}

function identifyCard(){
  const input=document.getElementById('cardCode');
  const code=normalizeCode(input.value);
  input.value=code;

  if(!/^[KMFEBRL]\d{3}$/.test(code)){
    renderError('卡號格式錯誤','請輸入例如 K001、M001。');
    return;
  }

  const c=cardDB[code];
  if(!c){
    renderError('查無卡牌',`${code} 尚未加入 cards.json。`);
    return;
  }

  renderCard(code,c);
}

function renderError(title,msg){
  document.getElementById('result').innerHTML=`<h2>⚠️ ${title}</h2><p>${msg}</p>`;
}

function renderCard(code,c){
  const r=document.getElementById('result');

  if(c.type==='knowledge'){
    battle=null;
    r.innerHTML=`<span class="tag">知識卡</span><span class="tag">${code}</span><h2>📖 ${c.name}</h2><p>${c.question}</p><div class="controls">${c.options.map((o,i)=>`<button onclick="answerKnowledge('${code}','${String.fromCharCode(65+i)}')">${o}</button>`).join('')}</div>`;
  }else if(c.type==='monster'){
    startMonsterBattle(code,c);
  }else if(c.type==='fate'){
    battle=null;
    r.innerHTML=`<span class="tag">命運卡</span><span class="tag">${code}</span><h2>🃏 ${c.name}</h2><p><b>${c.effect}</b></p><button onclick="applyFate('${code}')">執行效果</button>`;
  }else if(c.type==='equipment'){
    battle=null;
    r.innerHTML=`<span class="tag">裝備卡</span><span class="tag">${code}</span><h2>🎁 ${c.name}</h2><p>類型：${c.category}</p><p>動作：<b>${c.move}</b></p><p>效果：${c.effect}</p>`;
  }else if(c.type==='boss'){
    battle=null;
    r.innerHTML=`<span class="tag">魔王卡</span><span class="tag">${code}</span><h2>👑 ${c.name}</h2><p>第 ${c.stage} 階段</p><p>${c.effect}</p>`;
  }else{
    r.innerHTML=`<span class="tag">${code}</span><h2>${c.name||'卡牌'}</h2>`;
  }
}

function answerKnowledge(code,choice){
  const c=cardDB[code];
  const ok=choice===c.answer;
  changeHp(ok?2:-2);
  document.getElementById('result').innerHTML=`<h2>${ok?'✅ 回答正確':'❌ 回答錯誤'}</h2><p>${ok?'':'正確答案：<b>'+c.answer+'</b><br>'}${c.teach}</p><p>${ok?'❤️ +2 HP':'💔 -2 HP'}</p><button onclick="finishAdventure()">完成此冒險</button>`;
}

function applyFate(code){
  const c=cardDB[code];
  changeHp(c.hpChange||0);
  document.getElementById('result').innerHTML+=`<p><b>已結算：${c.effect}</b></p><button onclick="finishAdventure()">完成此冒險</button>`;
}

function startMonsterBattle(code,c){
  battle={
    code,
    name:c.name,
    maxHp:Number(c.hp)||1,
    hp:Number(c.hp)||1,
    atk:Number(c.atk)||0,
    weak:c.weak||'無',
    special:c.special||'',
    playerIndex:0,
    shield:0,
    round:1,
    log:[]
  };
  renderBattle();
}

function renderBattle(){
  if(!battle)return;

  const r=document.getElementById('result');
  const current=battle.playerIndex+1;
  const logs=battle.log.length?`<div class="note" style="margin-top:12px"><b>戰鬥紀錄：</b><br>${battle.log.slice(-4).join('<br>')}</div>`:'';

  r.innerHTML=`
    <span class="tag">怪獸卡</span><span class="tag">${battle.code}</span>
    <h2>⚔️ ${battle.name}</h2>
    <p style="font-size:22px">❤️ 怪獸 HP：<b>${battle.hp} / ${battle.maxHp}</b></p>
    <p>⚔️ ATK：<b>${battle.atk}</b>　🎯 弱點：<b>${battle.weak}</b></p>
    <p>${battle.special}</p>
    <hr>
    <h3>第 ${battle.round} 輪｜玩家 ${current} 行動</h3>
    <p class="note">先完成對應的實體動作，再按下效果按鈕。</p>
    <div class="controls">
      <button onclick="battleAttack(1,'👊 勇者之拳')">👊 勇者之拳｜傷害 1</button>
      <button onclick="battleAttack(2,'⚔️ 裝備攻擊')">⚔️ 裝備攻擊｜傷害 2</button>
      <button onclick="battleAttack(3,'🎯 弱點攻擊')">🎯 弱點攻擊｜傷害 3</button>
      <button onclick="battleShield()">🛡️ 平衡之盾｜反擊 -2</button>
      <button onclick="battleHeal()">👟 活力之靴｜生命 +2</button>
    </div>
    ${logs}`;
}

function battleAttack(dmg,label='攻擊'){
  if(!battle){
    alert('目前沒有進行中的怪獸戰鬥，請重新掃描怪獸卡。');
    return;
  }
  if(hp<=0)return;

  const before=battle.hp;
  battle.hp=Math.max(0,battle.hp-dmg);
  battle.log.push(`玩家 ${battle.playerIndex+1} 使用 ${label}：${before} → ${battle.hp}`);

  if(battle.hp<=0){
    monsterDefeated();
    return;
  }

  advanceBattleTurn();
}

function battleShield(){
  if(!battle){alert('目前沒有進行中的怪獸戰鬥。');return;}
  battle.shield+=2;
  battle.log.push(`玩家 ${battle.playerIndex+1} 使用平衡之盾，本輪防禦 +2`);
  advanceBattleTurn();
}

function battleHeal(){
  if(!battle){alert('目前沒有進行中的怪獸戰鬥。');return;}
  const before=hp;
  hp=Math.min(20,hp+2);
  battle.log.push(`玩家 ${battle.playerIndex+1} 使用活力之靴：團隊生命 ${before} → ${hp}`);
  updateUI();
  advanceBattleTurn();
}

function advanceBattleTurn(){
  if(!battle)return;

  battle.playerIndex++;

  if(battle.playerIndex>=playerCount){
    battle.playerIndex=0;
    monsterCounterAttack();
    if(!battle||hp<=0)return;
    battle.round++;
    battle.shield=0;
  }

  renderBattle();
}

function monsterCounterAttack(){
  if(!battle)return;

  const damage=Math.max(0,battle.atk-battle.shield);
  const monsterName=battle.name;

  if(damage>0){
    const before=hp;
    hp=Math.max(0,hp-damage);
    battle.log.push(`${monsterName} 反擊：團隊生命 ${before} → ${hp}`);
    updateUI();
    if(hp>0)alert(`${monsterName} 反擊！不老村生命 -${damage}`);
  }else{
    battle.log.push(`${monsterName} 的攻擊被完全擋下`);
    alert(`${monsterName} 的攻擊被防禦擋下！`);
  }
}

function monsterDefeated(){
  if(!battle)return;

  const name=battle.name;
  const reward=Math.random()<0.5?'fate':'equipment';
  battle=null;

  document.getElementById('result').innerHTML=`
    <h2>💀 ${name} 已擊敗！</h2>
    <p>怪獸 HP 已歸零，因此本輪不會反擊。</p>
    <hr>
    <h2>🎁 怪獸獎勵</h2>
    ${reward==='fate'
      ?'<p style="font-size:26px"><b>🃏 抽 1 張命運卡</b></p>'
      :'<p style="font-size:26px"><b>🎁 抽 1 張裝備卡</b></p>'}
    <p>請從桌上的實體牌堆抽取。</p>
    <button onclick="finishAdventure()">完成此冒險</button>`;
}

document.addEventListener('DOMContentLoaded',()=>{
  loadDatabase().catch(e=>renderError('資料庫載入失敗',e.message));
});
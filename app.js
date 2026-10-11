let cardDB={};
let hp=20,advNow=0,advTotal=12,playerCount=4;
let battle=null;
let pendingCardCode='';
let mediaStream=null,scanTimer=null;

async function loadDatabase(){
  const res=await fetch('./cards.json?v=4',{cache:'no-store'});
  if(!res.ok) throw new Error('cards.json 載入失敗');
  const data=await res.json();
  cardDB=data.cards||{};
  const card=new URLSearchParams(location.search).get('card');
  if(card){pendingCardCode=normalizeCode(card);document.getElementById('cardCode').value=pendingCardCode;}
}

function startGame(){
  const n=parseInt(document.getElementById('adventureTotal').value,10);
  if(!Number.isFinite(n)||n<1){alert('冒險卡數量至少 1 張');return;}
  advTotal=n;playerCount=parseInt(document.getElementById('players').value,10)||4;
  hp=20;advNow=0;battle=null;
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('advTotalText').textContent=advTotal;
  updateUI();
  const code=normalizeCode(document.getElementById('cardCode').value||pendingCardCode);
  if(code){document.getElementById('cardCode').value=code;identifyCard();}
}

function updateUI(){
  document.getElementById('hpText').textContent=hp;
  document.getElementById('advNowText').textContent=advNow;
  document.getElementById('hpfill').style.width=(hp/20*100)+'%';
  document.getElementById('progressfill').style.width=(Math.min(advNow/advTotal,1)*100)+'%';
  if(hp<=0){battle=null;document.getElementById('result').innerHTML='<h2>💀 不老村生命歸零</h2><p>本局失敗。</p>';}
  if(advNow>=advTotal&&hp>0&&!battle){document.getElementById('result').innerHTML='<h2>👑 冒險完成</h2><p>已達成本局冒險卡數量，可以進入最終魔王戰。</p>';}
}

function changeHp(n){hp=Math.max(0,Math.min(20,hp+n));updateUI();}
function finishAdventure(){if(advNow<advTotal)advNow++;battle=null;updateUI();}

function normalizeCode(raw){
  raw=(raw||'').trim().toUpperCase();
  try{if(/^https?:\/\//i.test(raw)){const u=new URL(raw);raw=(u.searchParams.get('card')||'').toUpperCase();}}catch(e){}
  return raw.replace(/\s+/g,'');
}

function identifyCard(){
  const input=document.getElementById('cardCode');
  const code=normalizeCode(input.value);input.value=code;
  if(!/^[KMFEBRL]\d{3}$/.test(code)){renderError('卡號格式錯誤','請輸入例如 K001、M001、E001。');return;}
  const c=cardDB[code];
  if(!c){renderError('查無卡牌',`${code} 尚未加入 cards.json。`);return;}
  if(battle && c.type==='equipment'){
    useEquipmentInBattle(code,c);
    return;
  }
  renderCard(code,c);
}

function renderError(title,msg){document.getElementById('result').innerHTML=`<h2>⚠️ ${title}</h2><p>${msg}</p>`;}

function renderCard(code,c){
  const r=document.getElementById('result');
  if(c.type==='knowledge'){
    battle=null;
    r.innerHTML=`<span class="tag">知識卡</span><span class="tag">${code}</span><h2>📖 ${c.name}</h2><p>${c.question}</p><div class="controls">${c.options.map((o,i)=>`<button onclick="answerKnowledge('${code}','${String.fromCharCode(65+i)}')">${o}</button>`).join('')}</div>`;
  }else if(c.type==='monster') startMonsterBattle(code,c);
  else if(c.type==='fate'){
    battle=null;r.innerHTML=`<span class="tag">命運卡</span><span class="tag">${code}</span><h2>🃏 ${c.name}</h2><p><b>${c.effect}</b></p><button onclick="applyFate('${code}')">執行效果</button>`;
  }else if(c.type==='equipment'){
    battle=null;r.innerHTML=`<span class="tag">裝備卡</span><span class="tag">${code}</span><h2>🎁 ${c.name}</h2><p>類型：${c.category}</p><p>動作：<b>${c.move}</b></p><p>效果：${c.effect}</p>`;
  }else if(c.type==='boss'){
    if(Number(c.hp)>0) startBossBattle(code,c);
    else{battle=null;r.innerHTML=`<span class="tag">魔王卡</span><span class="tag">${code}</span><h2>👑 ${c.name}</h2><p>第 ${c.stage} 階段</p><p>${c.effect}</p>`;}
  }else r.innerHTML=`<span class="tag">${code}</span><h2>${c.name||'卡牌'}</h2>`;
}

function answerKnowledge(code,choice){
  const c=cardDB[code],ok=choice===c.answer;changeHp(ok?2:-2);
  document.getElementById('result').innerHTML=`<h2>${ok?'✅ 回答正確':'❌ 回答錯誤'}</h2><p>${ok?'':'正確答案：<b>'+c.answer+'</b><br>'}${c.teach}</p><p>${ok?'❤️ +2 HP':'💔 -2 HP'}</p><button onclick="finishAdventure()">完成此冒險</button>`;
}

function applyFate(code){const c=cardDB[code];changeHp(c.hpChange||0);document.getElementById('result').innerHTML+=`<p><b>已結算：${c.effect}</b></p><button onclick="finishAdventure()">完成此冒險</button>`;}

function startMonsterBattle(code,c){
  const monsterHp=Math.min(10,Math.max(5,Number(c.hp)||5));
  battle={kind:'monster',code,name:c.name,maxHp:monsterHp,hp:monsterHp,atk:Number(c.atk)||0,weak:c.weak||'無',special:c.special||'',playerIndex:0,shield:0,round:1,log:[]};
  renderBattle();
}

function startBossBattle(code,c){
  battle={kind:'boss',code,name:c.name,maxHp:20,hp:20,atk:Number(c.atk)||2,weak:'無',special:c.effect||'',playerIndex:0,shield:0,round:1,log:[]};
  renderBattle();
}

function renderBattle(){
  if(!battle)return;
  const r=document.getElementById('result');
  const current=battle.playerIndex+1,isBoss=battle.kind==='boss';
  const logs=battle.log.length?`<div class="note" style="margin-top:12px"><b>戰鬥紀錄：</b><br>${battle.log.slice(-6).join('<br>')}</div>`:'';
  r.innerHTML=`
    <span class="tag">${isBoss?'魔王卡':'怪獸卡'}</span><span class="tag">${battle.code}</span>
    <h2>${isBoss?'👑':'⚔️'} ${battle.name}</h2>
    <p style="font-size:22px">❤️ ${isBoss?'魔王':'怪獸'} HP：<b>${battle.hp} / ${battle.maxHp}</b></p>
    <p>⚔️ ATK：<b>${battle.atk}</b>${isBoss?'':'　🎯 弱點：<b>'+battle.weak+'</b>'}</p>
    <p>${battle.special}</p><hr>
    <h3>第 ${battle.round} 輪｜玩家 ${current} / ${playerCount}</h3>
    <p class="note">每位玩家各行動 1 次；全部玩家完成後，敵人才反擊 1 次。</p>
    <div class="controls"><button onclick="battleAttack(1,'👊 勇者之拳')">👊 沒有裝備：勇者之拳｜傷害 1</button></div>
    <div style="margin-top:14px;padding:14px;border:2px dashed #c9b98f;border-radius:12px">
      <b>📷 有裝備：掃描裝備卡</b>
      <p class="note">先完成卡片上的身體動作，再掃 QR／輸入 E001～E005。程式會自動判定攻擊、防禦、補血與弱點。</p>
      <div class="grid"><input id="battleScanCode" placeholder="例如 E001"><button onclick="submitBattleScan()">判定裝備</button></div>
      <div class="controls"><button onclick="startBattleScanner()">📷 開啟相機掃 QR</button><button onclick="stopBattleScanner()">停止相機</button></div>
      <div id="battleVideoWrap" style="display:none;margin-top:10px"><video id="battleVideo" playsinline style="width:100%;max-height:320px;background:#111;border-radius:10px"></video></div>
      <div id="scanStatus" class="note"></div>
    </div>${logs}`;
}

function submitBattleScan(){
  if(!battle)return;
  const el=document.getElementById('battleScanCode');
  const code=normalizeCode(el?el.value:'');
  const c=cardDB[code];
  if(!c){alert('找不到這張卡，請確認卡號。');return;}
  if(c.type!=='equipment'){alert('戰鬥中請掃裝備卡 E001～E005。');return;}
  useEquipmentInBattle(code,c);
}

function useEquipmentInBattle(code,c){
  if(!battle){alert('目前沒有進行中的戰鬥。');return;}
  const action=c.combat?.action;
  const category=c.category||'';
  const weakHit=battle.kind==='monster' && category===battle.weak;
  const player=battle.playerIndex+1;
  let message=`玩家 ${player}/${playerCount} 掃描 ${code} ${c.name}`;

  if(action==='attack'){
    const dmg=(Number(c.combat.value)||0)+(weakHit?1:0);
    const before=battle.hp;battle.hp=Math.max(0,battle.hp-dmg);
    message+=`：${c.move}，造成 ${dmg} 傷害${weakHit?'（命中弱點 +1）':''}，${before} → ${battle.hp}`;
    battle.log.push(message);
    if(battle.hp<=0){battleDefeated();return;}
  }else if(action==='shield'){
    battle.shield+=Number(c.combat.value)||0;
    message+=`：${c.move}，本輪敵人反擊傷害 -${c.combat.value}`;
    battle.log.push(message);
  }else if(action==='heal'){
    const beforeHp=hp;hp=Math.min(20,hp+(Number(c.combat.value)||0));updateUI();
    message+=`：${c.move}，團隊生命 ${beforeHp} → ${hp}`;
    if(weakHit && Number(c.combat.weakDamage)>0){
      const before=battle.hp;battle.hp=Math.max(0,battle.hp-Number(c.combat.weakDamage));
      message+=`；命中心肺弱點，另造成 ${c.combat.weakDamage} 傷害，敵人 ${before} → ${battle.hp}`;
      battle.log.push(message);
      if(battle.hp<=0){battleDefeated();return;}
    }else battle.log.push(message);
  }else if(action==='cognitive'){
    const dmg=weakHit?(Number(c.combat.weakValue)||1):(Number(c.combat.value)||1);
    const before=battle.hp;battle.hp=Math.max(0,battle.hp-dmg);
    message+=`：${c.move}，造成 ${dmg} 傷害${weakHit?'（認知弱點命中）':''}，${before} → ${battle.hp}`;
    battle.log.push(message);
    if(battle.hp<=0){battleDefeated();return;}
  }else{
    alert('這張裝備尚未設定戰鬥效果。');return;
  }
  advanceBattleTurn();
}

function battleAttack(dmg,label='攻擊'){
  if(!battle){alert('目前沒有進行中的戰鬥，請重新讀取卡牌。');return;}
  if(hp<=0)return;
  const before=battle.hp;battle.hp=Math.max(0,battle.hp-dmg);
  battle.log.push(`玩家 ${battle.playerIndex+1}/${playerCount} 使用 ${label}：${before} → ${battle.hp}`);
  if(battle.hp<=0){battleDefeated();return;}
  advanceBattleTurn();
}

function advanceBattleTurn(){
  if(!battle)return;
  battle.playerIndex++;
  if(battle.playerIndex>=playerCount){
    battle.playerIndex=0;enemyCounterAttack();
    if(!battle||hp<=0)return;
    battle.round++;battle.shield=0;
  }
  renderBattle();
}

function enemyCounterAttack(){
  if(!battle)return;
  const damage=Math.max(0,battle.atk-battle.shield),enemyName=battle.name;
  if(damage>0){const before=hp;hp=Math.max(0,hp-damage);battle.log.push(`${enemyName} 在全體玩家行動結束後反擊：團隊生命 ${before} → ${hp}`);updateUI();if(hp>0)alert(`${enemyName} 反擊！不老村生命 -${damage}`);}
  else{battle.log.push(`${enemyName} 的反擊被完全擋下`);alert(`${enemyName} 的反擊被防禦擋下！`);}
}

function battleDefeated(){
  if(!battle)return;
  stopBattleScanner();
  const name=battle.name,kind=battle.kind;battle=null;
  if(kind==='boss'){document.getElementById('result').innerHTML=`<h2>🏆 ${name} 已擊敗！</h2><p>魔王 20 HP 已歸零，團隊獲勝！</p>`;return;}
  const reward=Math.random()<0.5?'fate':'equipment';
  document.getElementById('result').innerHTML=`<h2>💀 ${name} 已擊敗！</h2><p>怪獸 HP 已歸零，因此本輪不會反擊。</p><hr><h2>🎁 怪獸獎勵</h2>${reward==='fate'?'<p style="font-size:26px"><b>🃏 抽 1 張命運卡</b></p>':'<p style="font-size:26px"><b>🎁 抽 1 張裝備卡</b></p>'}<p>請從桌上的實體牌堆抽取。</p><button onclick="finishAdventure()">完成此冒險</button>`;
}

async function startBattleScanner(){
  const status=document.getElementById('scanStatus');
  if(!battle)return;
  if(!('BarcodeDetector' in window)){if(status)status.textContent='此瀏覽器不支援內建 QR 掃描，請直接輸入卡號 E001～E005。';return;}
  try{
    const formats=await BarcodeDetector.getSupportedFormats();
    if(!formats.includes('qr_code')){if(status)status.textContent='此裝置不支援 QR Code 辨識，請改用卡號輸入。';return;}
    const detector=new BarcodeDetector({formats:['qr_code']});
    mediaStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
    const video=document.getElementById('battleVideo');
    video.srcObject=mediaStream;await video.play();
    document.getElementById('battleVideoWrap').style.display='block';
    if(status)status.textContent='相機已開啟，請將裝備卡 QR Code 放入畫面。';
    scanTimer=setInterval(async()=>{
      try{
        const found=await detector.detect(video);
        if(found.length){
          const code=normalizeCode(found[0].rawValue);
          const c=cardDB[code];
          if(c&&c.type==='equipment'){
            stopBattleScanner();
            useEquipmentInBattle(code,c);
          }
        }
      }catch(e){}
    },450);
  }catch(e){if(status)status.textContent='無法開啟相機，請確認權限，或改用卡號輸入。';}
}

function stopBattleScanner(){
  if(scanTimer){clearInterval(scanTimer);scanTimer=null;}
  if(mediaStream){mediaStream.getTracks().forEach(t=>t.stop());mediaStream=null;}
  const wrap=document.getElementById('battleVideoWrap');if(wrap)wrap.style.display='none';
}

document.addEventListener('DOMContentLoaded',()=>{loadDatabase().catch(e=>renderError('資料庫載入失敗',e.message));});
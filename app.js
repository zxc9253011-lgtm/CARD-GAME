let cardDB={};
let hp=20,advNow=0,advTotal=12,playerCount=4;
let battle=null;
let pendingCardCode='';

let scannerStream=null;
let scannerMode='game';
let scannerBusy=false;
let ocrWorker=null;

async function loadDatabase(){
  const res=await fetch('./cards.json?v=4',{cache:'no-store'});
  if(!res.ok) throw new Error('cards.json 載入失敗');
  const data=await res.json();
  cardDB=data.cards||{};
  const card=new URLSearchParams(location.search).get('card');
  if(card){
    pendingCardCode=normalizeCode(card);
    const input=document.getElementById('cardCode');
    if(input) input.value=pendingCardCode;
    const s=document.getElementById('setupScanStatus');
    if(s) s.textContent=`已偵測網址卡牌：${pendingCardCode}`;
  }
}

function startGame(){
  const n=parseInt(document.getElementById('adventureTotal').value,10);
  if(!Number.isFinite(n)||n<1){alert('冒險卡數量至少 1 張');return;}
  advTotal=n;
  playerCount=parseInt(document.getElementById('players').value,10)||4;
  hp=20;advNow=0;battle=null;
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('advTotalText').textContent=advTotal;
  updateUI();
  const input=document.getElementById('cardCode');
  const code=normalizeCode((input&&input.value)||pendingCardCode);
  if(code){input.value=code;identifyCard();}
}

function updateUI(){
  const hpEl=document.getElementById('hpText');
  const advEl=document.getElementById('advNowText');
  const hpFill=document.getElementById('hpfill');
  const progFill=document.getElementById('progressfill');
  if(hpEl) hpEl.textContent=hp;
  if(advEl) advEl.textContent=advNow;
  if(hpFill) hpFill.style.width=(hp/20*100)+'%';
  if(progFill) progFill.style.width=(Math.min(advNow/advTotal,1)*100)+'%';
  if(hp<=0){
    battle=null;
    const r=document.getElementById('result');
    if(r) r.innerHTML='<h2>💀 不老村生命歸零</h2><p>本局失敗。</p>';
  }
  if(advNow>=advTotal&&hp>0&&!battle){
    const r=document.getElementById('result');
    if(r) r.innerHTML='<h2>👑 冒險完成</h2><p>已達成本局冒險卡數量，可以進入最終魔王戰。</p>';
  }
}

function changeHp(n){hp=Math.max(0,Math.min(20,hp+n));updateUI();}
function finishAdventure(){if(advNow<advTotal)advNow++;battle=null;updateUI();}

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
  const code=normalizeCode(input?input.value:'');
  if(input) input.value=code;
  if(!/^[KMFEBRL]\d{3}$/.test(code)){renderError('卡號格式錯誤','請輸入例如 K001、M001、E001。');return;}
  const c=cardDB[code];
  if(!c){renderError('查無卡牌',`${code} 尚未加入 cards.json。`);return;}
  if(battle && c.type==='equipment'){useEquipmentInBattle(code,c);return;}
  renderCard(code,c);
}

function renderError(title,msg){
  const r=document.getElementById('result');
  if(r) r.innerHTML=`<h2>⚠️ ${title}</h2><p>${msg}</p>`;
}

function renderCard(code,c){
  const r=document.getElementById('result');
  if(!r)return;
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
    if(Number(c.hp)>0) startBossBattle(code,c);
    else{
      battle=null;
      r.innerHTML=`<span class="tag">魔王卡</span><span class="tag">${code}</span><h2>👑 ${c.name}</h2><p>第 ${c.stage} 階段</p><p>${c.effect}</p>`;
    }
  }else{
    r.innerHTML=`<span class="tag">${code}</span><h2>${c.name||'卡牌'}</h2>`;
  }
}

function answerKnowledge(code,choice){
  const c=cardDB[code],ok=choice===c.answer;
  changeHp(ok?2:-2);
  document.getElementById('result').innerHTML=`<h2>${ok?'✅ 回答正確':'❌ 回答錯誤'}</h2><p>${ok?'':'正確答案：<b>'+c.answer+'</b><br>'}${c.teach}</p><p>${ok?'❤️ +2 HP':'💔 -2 HP'}</p><button onclick="finishAdventure()">完成此冒險</button>`;
}

function applyFate(code){
  const c=cardDB[code];
  changeHp(c.hpChange||0);
  document.getElementById('result').innerHTML+=`<p><b>已結算：${c.effect}</b></p><button onclick="finishAdventure()">完成此冒險</button>`;
}

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
      <b>📷 有裝備：辨識裝備卡號</b>
      <p class="note">完成卡片動作後，把 E001～E005 的大字卡號放進辨識框。</p>
      <div class="grid"><input id="battleScanCode" placeholder="例如 E001"><button onclick="submitBattleScan()">判定裝備</button></div>
      <div class="controls"><button onclick="startScanner('battle')">📷 辨識裝備卡號</button></div>
    </div>${logs}`;
}

function submitBattleScan(){
  if(!battle)return;
  const el=document.getElementById('battleScanCode');
  const code=normalizeCode(el?el.value:'');
  const c=cardDB[code];
  if(!c){alert('找不到這張卡，請確認卡號。');return;}
  if(c.type!=='equipment'){alert('戰鬥中請使用裝備卡 E001～E005。');return;}
  useEquipmentInBattle(code,c);
}

function useEquipmentInBattle(code,c){
  if(!battle){alert('目前沒有進行中的戰鬥。');return;}
  const action=c.combat?.action;
  const category=c.category||'';
  const weakHit=battle.kind==='monster' && category===battle.weak;
  const player=battle.playerIndex+1;
  let message=`玩家 ${player}/${playerCount} 使用 ${code} ${c.name}`;
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
    battle.playerIndex=0;
    enemyCounterAttack();
    if(!battle||hp<=0)return;
    battle.round++;
    battle.shield=0;
  }
  renderBattle();
}

function enemyCounterAttack(){
  if(!battle)return;
  const damage=Math.max(0,battle.atk-battle.shield),enemyName=battle.name;
  if(damage>0){
    const before=hp;hp=Math.max(0,hp-damage);
    battle.log.push(`${enemyName} 在全體玩家行動結束後反擊：團隊生命 ${before} → ${hp}`);
    updateUI();
    if(hp>0) alert(`${enemyName} 反擊！不老村生命 -${damage}`);
  }else{
    battle.log.push(`${enemyName} 的反擊被完全擋下`);
    alert(`${enemyName} 的反擊被防禦擋下！`);
  }
}

function battleDefeated(){
  if(!battle)return;
  stopScanner();
  const name=battle.name,kind=battle.kind;
  battle=null;
  if(kind==='boss'){
    document.getElementById('result').innerHTML=`<h2>🏆 ${name} 已擊敗！</h2><p>魔王 20 HP 已歸零，團隊獲勝！</p>`;
    return;
  }
  const reward=Math.random()<0.5?'fate':'equipment';
  document.getElementById('result').innerHTML=`<h2>💀 ${name} 已擊敗！</h2><p>怪獸 HP 已歸零，因此本輪不會反擊。</p><hr><h2>🎁 怪獸獎勵</h2>${reward==='fate'?'<p style="font-size:26px"><b>🃏 抽 1 張命運卡</b></p>':'<p style="font-size:26px"><b>🎁 抽 1 張裝備卡</b></p>'}<p>請從桌上的實體牌堆抽取。</p><button onclick="finishAdventure()">完成此冒險</button>`;
}

async function startScanner(mode='game'){
  scannerMode=mode;
  const modal=document.getElementById('scannerModal');
  const video=document.getElementById('scannerVideo');
  const status=document.getElementById('scannerStatus');
  if(!modal||!video)return;
  modal.classList.remove('hidden');
  if(status)status.textContent='正在開啟相機…';
  try{
    scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    video.srcObject=scannerStream;
    await video.play();
    if(status)status.textContent='把「卡號」完整放進白框，盡量靠近並保持水平，再按「辨識」。';
  }catch(e){
    if(status)status.textContent='無法開啟相機。請確認瀏覽器已允許此網站使用相機。';
  }
}

function stopScanner(){
  if(scannerStream){scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null;}
  const video=document.getElementById('scannerVideo');
  if(video)video.srcObject=null;
  const modal=document.getElementById('scannerModal');
  if(modal)modal.classList.add('hidden');
  scannerBusy=false;
}

function digitNormalize(s){
  return (s||'').toUpperCase()
    .replace(/[OQD]/g,'0')
    .replace(/[IL]/g,'1')
    .replace(/Z/g,'2')
    .replace(/S/g,'5')
    .replace(/G/g,'6')
    .replace(/T/g,'7')
    .replace(/B/g,'8');
}

function extractCardCodeFromText(text,mode='game'){
  const compact=(text||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const allowed='KMFEBRL';
  const validKeys=Object.keys(cardDB);
  const candidates=[];

  for(let i=0;i<compact.length;i++){
    const prefix=compact[i];
    if(!allowed.includes(prefix))continue;
    const tail=digitNormalize(compact.slice(i+1,i+7)).replace(/\D/g,'');
    if(!tail)continue;

    for(const len of [3,2,1]){
      if(tail.length>=len){
        const code=prefix+tail.slice(0,len).padStart(3,'0');
        candidates.push(code);
        break;
      }
    }
  }

  const unique=[...new Set(candidates)];
  if(mode==='battle'){
    const equipment=unique.find(x=>/^E\d{3}$/.test(x)&&cardDB[x]?.type==='equipment');
    if(equipment)return equipment;
  }else{
    const exact=unique.find(x=>validKeys.includes(x));
    if(exact)return exact;
  }
  return '';
}

function buildOCRCanvas(video,threshold=160){
  const canvas=document.createElement('canvas');
  const vw=video.videoWidth, vh=video.videoHeight;
  if(!vw||!vh)return null;

  // 與畫面白框一致：左右各 10%，上 38%，高度 24%。
  const sx=Math.round(vw*0.10);
  const sy=Math.round(vh*0.38);
  const sw=Math.round(vw*0.80);
  const sh=Math.round(vh*0.24);
  const scale=3;

  canvas.width=sw*scale;
  canvas.height=sh*scale;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);

  const img=ctx.getImageData(0,0,canvas.width,canvas.height);
  const d=img.data;
  for(let i=0;i<d.length;i+=4){
    const gray=Math.round(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]);
    const v=gray<threshold?0:255;
    d[i]=d[i+1]=d[i+2]=v;
    d[i+3]=255;
  }
  ctx.putImageData(img,0,0);
  return canvas;
}

async function getOCRWorker(){
  if(ocrWorker)return ocrWorker;
  if(!window.Tesseract)throw new Error('OCR 模組尚未載入');
  ocrWorker=await Tesseract.createWorker('eng');
  await ocrWorker.setParameters({
    tessedit_char_whitelist:'KMFEBRL0123456789',
    preserve_interword_spaces:'0'
  });
  return ocrWorker;
}

async function recognizeOnce(worker,canvas,psm){
  await worker.setParameters({tessedit_pageseg_mode:String(psm)});
  const result=await worker.recognize(canvas);
  return result?.data?.text||'';
}

async function recognizeCardText(){
  if(scannerBusy)return;
  const video=document.getElementById('scannerVideo');
  const status=document.getElementById('scannerStatus');
  if(!video||!video.videoWidth){if(status)status.textContent='相機尚未準備完成。';return;}

  scannerBusy=true;
  if(status)status.textContent='辨識中…第一次使用可能需要幾秒。';

  try{
    const worker=await getOCRWorker();
    const passes=[
      {threshold:140,psm:7},
      {threshold:140,psm:8},
      {threshold:180,psm:7}
    ];
    const seen=[];
    let code='';

    for(const pass of passes){
      const processed=buildOCRCanvas(video,pass.threshold);
      if(!processed)continue;
      const text=await recognizeOnce(worker,processed,pass.psm);
      seen.push(text.trim());
      code=extractCardCodeFromText(text,scannerMode);
      if(code)break;
    }

    if(!code){
      if(status)status.textContent=`沒有可靠辨識到卡號。OCR：${seen.filter(Boolean).join(' / ')||'無文字'}。請把卡號放大填滿白框再試。`;
      scannerBusy=false;
      return;
    }

    if(status)status.textContent=`辨識成功：${code}`;
    if(scannerMode==='setup'){
      pendingCardCode=code;
      const input=document.getElementById('cardCode');
      if(input)input.value=code;
      const s=document.getElementById('setupScanStatus');
      if(s)s.textContent=`已辨識：${code}`;
      setTimeout(stopScanner,400);
    }else if(scannerMode==='battle'){
      const c=cardDB[code];
      if(!c||c.type!=='equipment'){
        if(status)status.textContent=`辨識到 ${code}，但戰鬥中只能使用裝備卡。`;
        scannerBusy=false;
        return;
      }
      stopScanner();
      useEquipmentInBattle(code,c);
    }else{
      const input=document.getElementById('cardCode');
      if(input)input.value=code;
      stopScanner();
      identifyCard();
    }
  }catch(e){
    console.error(e);
    if(status)status.textContent='辨識失敗，請重新對準卡號後再試。';
    scannerBusy=false;
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  loadDatabase().catch(e=>renderError('資料庫載入失敗',e.message));
});
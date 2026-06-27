let data=null,profile=null,currentTopic=null,currentIndex=0,correctCount=0,halfCount=0,sessionXP=0,sessionCoins=0;

async function start(){
  profile=JSON.parse(localStorage.getItem("jannati_profile_v03")||"null");
  const r=await fetch("data/bm_tahun2.json");
  data=await r.json();
  profile?showDashboard():showLogin();
}

function hideAll(){["login","dashboard","quiz","finish"].forEach(id=>document.getElementById(id).classList.add("hidden"))}
function showLogin(){hideAll();document.getElementById("login").classList.remove("hidden")}
function saveProfile(){profile={name:document.getElementById("nameInput").value.trim()||"Anak",xp:0,coins:0,streak:0,lastStudy:"",progress:{},badges:[]};save();showDashboard()}
function resetProfile(){if(confirm("Reset semua rekod?")){localStorage.removeItem("jannati_profile_v03");showLogin()}}
function save(){localStorage.setItem("jannati_profile_v03",JSON.stringify(profile))}

function showDashboard(){
  hideAll();document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("greeting").innerText="Assalamualaikum, "+profile.name+" 😊";
  document.getElementById("xp").innerText=profile.xp||0;
  document.getElementById("level").innerText=Math.floor((profile.xp||0)/100)+1;
  document.getElementById("coins").innerText=profile.coins||0;
  document.getElementById("streak").innerText=profile.streak||0;
  let total=data.topics.reduce((a,t)=>a+t.questions.length,0);
  document.getElementById("totalInfo").innerText=data.topics.length+" topik • "+total+" soalan";

  const doneCount=Object.keys(profile.progress||{}).filter(k=>(profile.progress[k].best||0)>=80).length;
  const missionPercent=Math.min(100,Math.round((doneCount/data.topics.length)*100));
  document.getElementById("missionBar").style.width=missionPercent+"%";
  document.getElementById("missionText").innerText=missionPercent+"% siap • "+doneCount+"/"+data.topics.length+" lencana";

  const list=document.getElementById("topicList");list.innerHTML="";
  data.topics.forEach(t=>{
    const p=profile.progress[t.id];
    const btn=document.createElement("button");
    btn.className="topic "+(p&&p.best>=80?"done":"");
    btn.innerHTML=(p&&p.best>=80?"🏅 ":"📘 ")+t.title+"<small>"+t.questions.length+" soalan • "+(p?("Terbaik: "+p.best+"%"):"Belum cuba")+"</small>";
    btn.onclick=()=>startQuiz(t.id);
    list.appendChild(btn);
  });

  const badges=document.getElementById("badges");badges.innerHTML="";
  if(!profile.badges || profile.badges.length===0){badges.innerHTML="<p>Belum ada lencana. Siapkan topik dengan 80% ke atas.</p>";}
  else profile.badges.forEach(b=>badges.innerHTML+=`<span class="badgeItem">🏅 ${b}</span>`);

  const progress=document.getElementById("progressList");progress.innerHTML="";
  data.topics.forEach(t=>{
    const p=profile.progress[t.id];
    progress.innerHTML+=`<div class="progressItem"><span>${t.title}</span><b>${p?p.best+"%":"-"}</b></div>`;
  });
}

function startQuiz(id){
  currentTopic=data.topics.find(t=>t.id===id);
  currentIndex=0;correctCount=0;halfCount=0;sessionXP=0;sessionCoins=0;
  hideAll();document.getElementById("quiz").classList.remove("hidden");
  document.getElementById("topicTitle").innerText=currentTopic.title;
  document.getElementById("topicNote").innerText=currentTopic.note;
  loadQuestion();
}

function loadQuestion(){
  const q=currentTopic.questions[currentIndex];
  document.getElementById("quizCounter").innerText=(currentIndex+1)+"/"+currentTopic.questions.length;
  document.getElementById("questionNo").innerText="Soalan "+(currentIndex+1);
  document.getElementById("questionText").innerText=q.q;
  document.getElementById("answerInput").value="";
  document.getElementById("feedback").className="feedback hidden";
  document.getElementById("quizBar").style.width=Math.round((currentIndex/currentTopic.questions.length)*100)+"%";
  setTimeout(()=>document.getElementById("answerInput").focus(),100);
}

function speakQuestion(){
  const text=document.getElementById("questionText").innerText.replaceAll("________"," kosong ");
  if(!("speechSynthesis" in window)){alert("Browser ini tidak menyokong bacaan suara.");return;}
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang="ms-MY";
  u.rate=0.88;
  window.speechSynthesis.speak(u);
}

function beep(type="good"){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value=type==="good"?720:type==="mid"?440:220;
    gain.gain.value=0.08;
    osc.start();
    setTimeout(()=>{osc.stop();ctx.close();}, type==="good"?180:260);
  }catch(e){}
}

function norm(s){return(s||"").toString().toLowerCase().trim().replace(/[.,!?]/g,"").replace(/\s+/g," ")}
function removeCommonWords(s){return norm(s).replace(/^air\s+/,"").replace(/^minuman\s+/,"").replace(/^susu\s+/,"").replace(/^sebiji\s+/,"").replace(/^sebatang\s+/,"").replace(/^seekor\s+/,"").replace(/^sebuah\s+/,"").replace(/^satu\s+/,"").replace(/^negeri\s+/,"").trim()}

function smartCheck(user,item){
  const u=norm(user),ans=norm(item.answer),uS=removeCommonWords(user),aS=removeCommonWords(item.answer),acc=(item.accepted||[]).map(norm),alm=(item.almost||[]).map(norm);
  if(!u)return{status:"bad",title:"Belum jawab",msg:"Tulis jawapan dahulu ya."};
  if(u===ans||uS===aS||acc.includes(u))return{status:"good",title:"Betul!",msg:"Jawapan kamu diterima."};
  if(u.includes(ans)||ans.includes(u)||acc.some(a=>u.includes(a)||a.includes(u)))return{status:"good",title:"Betul!",msg:"Maksud jawapan kamu masih tepat."};
  if(alm.includes(u)||alm.some(a=>u.includes(a)||a.includes(u)))return{status:"mid",title:"Hampir betul",msg:"Jawapan kamu ada kaitan, tetapi perlu lebih tepat."};
  return{status:"bad",title:"Belum tepat",msg:"Cuba semak semula jawapan kamu."};
}

function checkAnswer(){
  const q=currentTopic.questions[currentIndex],user=document.getElementById("answerInput").value,res=smartCheck(user,q),fb=document.getElementById("feedback");
  fb.className="feedback "+res.status;
  beep(res.status);
  let xp=0,coin=0;
  if(res.status==="good"){correctCount++;xp=10;coin=5;sessionXP+=10;sessionCoins+=5}
  else if(res.status==="mid"){halfCount++;xp=5;coin=2;sessionXP+=5;sessionCoins+=2}
  const extra=res.status==="good"?`<p>⭐ +${xp} XP • 🪙 +${coin} coins</p><p>AI Tutor: Jawapan kamu diterima. Jawapan paling tepat: <b>${q.answer}</b>.</p>`:res.status==="mid"?`<p>⭐ +${xp} XP • 🪙 +${coin} coins</p><p>AI Tutor: ${q.hint}</p><p>Cadangan jawapan: <b>${q.answer}</b></p>`:`<p>AI Tutor: ${q.hint}</p><p>Jawapan betul: <b>${q.answer}</b></p>`;
  fb.innerHTML=`<h2>${res.status==="good"?"🟢":res.status==="mid"?"🟡":"🔴"} ${res.title}</h2><p>${res.msg}</p>${extra}<button onclick="nextQuestion()">Seterusnya</button>`;
  fb.classList.remove("hidden");
}

function showHint(){const q=currentTopic.questions[currentIndex],fb=document.getElementById("feedback");fb.className="feedback mid";fb.innerHTML=`<h2>💡 Hint</h2><p>${q.hint}</p>`}
function nextQuestion(){currentIndex++;currentIndex>=currentTopic.questions.length?finishQuiz():loadQuestion()}

function finishQuiz(){
  beep("good");
  const total=currentTopic.questions.length,score=correctCount+halfCount*.5,percent=Math.round(score/total*100);
  profile.xp=(profile.xp||0)+sessionXP; profile.coins=(profile.coins||0)+sessionCoins;
  const today=new Date().toISOString().slice(0,10);
  if(profile.lastStudy!==today){profile.streak=(profile.streak||0)+1;profile.lastStudy=today}
  const old=profile.progress[currentTopic.id]?.best||0;
  profile.progress[currentTopic.id]={best:Math.max(old,percent),last:percent};
  if(percent>=80){
    profile.badges=profile.badges||[];
    if(!profile.badges.includes(currentTopic.title)) profile.badges.push(currentTopic.title);
  }
  save();
  hideAll();document.getElementById("finish").classList.remove("hidden");
  document.getElementById("finishText").innerHTML=`${profile.name}, markah kamu <b>${percent}%</b><br>XP: <b>+${sessionXP}</b> • Coins: <b>+${sessionCoins}</b>`;
  document.getElementById("badgeText").innerText=percent>=80?"🏅 Lencana "+currentTopic.title:"💪 Cuba lagi untuk buka lencana";
}

document.addEventListener("keydown",e=>{if(e.key==="Enter"&&!document.getElementById("quiz").classList.contains("hidden")){document.getElementById("feedback").classList.contains("hidden")?checkAnswer():nextQuestion()}});
start();

import React,{useEffect,useRef,useState} from 'react';
import chapters from './chapters.js';

const API_KEY=import.meta.env.VITE_OPENROUTER_API_KEY||'';

const MODELS=[
 'openrouter/auto',
 'meta-llama/llama-3.3-70b-instruct:free',
 'google/gemini-2.5-flash:free',
 'mistralai/mistral-small-3:free',
 'qwen/qwen-2.5-72b-instruct:free'
];

const SCORE=/архитект|строитель|строени|сооруж|конструкц|здан|дом|колонн|балк|фундамент|нагруз|пожарн|материал|фасад|перекры|стен|каркас|инженер|арка|купол|свод|лестниц|bim|проектир|бетон|кирпич|железобетон|дерев|стал|металл|камен|штукатур|цемент|арматур|профил|свай|перегород|окно|двер|крыш|кровл|пол|плит|оболоч|монолит|сборн|панел|шов|узел|чертеж|этаж|основан|грунт|огнестойк|горюч|токсич|дым|эвакуац|инсоляц|акустик|отделк|покрыти|облицовк|утеплител|изоляц|стой|проём|пролет|ригель|мембран|обследован|усилен|реконструкц|реставрац|ремонт|перил|балюстрад|эркер|балкон|лоджи|карниз|фронтон|вентиляц|отоплен|водопровод|канализ|электроснабжен|освещен|лифт|потолок|напольн|сейсмич|ферм|структур|устойчив|жесткост|деформац|шв|соедин|уплотн|герметик|монтаж|кладк|раствор|стяжк|финишн|энергоэффектив|комфорт|планиров|зонирован|композиц|эргономик|интерьер|экстерьер|визуализац|рендер|перспектив|генплан|разрез|разработк|дизайн|детальн|колорист|пространств|объёмн|формообраз|стиль|экологичн|устойчив|биоклимат|идéя|творческ/i;

const SYS_INSTR='Ты — помощник «Bat AI» учебного сайта ARCHISTUDY (архитектура, строительные конструкции, строительные и отделочные материалы, BIM, проектирование и разработка проектов).\nОтветай на русском языке, кратко и по существу (3–6 предложений), простым языком.\nТы отвечаешь на вопросы по архитектуре, BIM, разработке и проектированию зданий, а также по материалам курса (вкладка «Материал»).\nПравила:\n1. Сначала ищи ответ в предоставленном материале курса (обзор глав и фрагменты страниц). Если ответ есть — отвечай по нему и указывай страницы.\n2. Если в материале курса ответа нет, но вопрос по архитектуре, BIM, проектированию или строительству — отвечай из своих знаний, но обязательно начни ответ с пометки «ℹ️ Ответ нейросети:» (эта информация НЕ из материала курса).\n3. Не выдумывай и не указывай страницы, которых нет во фрагментах. Не выдумывай фактов, которых нет ни в материале, ни в твоих знаний — если сомневаешься, честно так и скажи.\n4. Если вопрос не относится к архитектуре, BIM, проектированию, строительству или материалам (например, еда, фильмы, погода, программирование) — вежливо откажись и предложи спросить по архитектуре или материалам курса.';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function cleanPage(text){return text.replace(/^===PAGE\s*\d*===\s*/,'').trim()}

function retrieve(pages,q,maxChars=16000){
 if((pages||[]).length===0)return [];
 const words=q.toLowerCase().match(/[а-яёa-z0-9]{4,}/g)||[];
 const scored=[];
 for(let i=0;i<pages.length;i++){
  const text=cleanPage(pages[i]);if(!text)continue;
  const lower=text.toLowerCase();
  let n=0;for(const w of words)if(lower.includes(w))n++;
  if(n>0)scored.push({i:i+1,text,n});
 }
 scored.sort((a,b)=>b.n-a.n);
 const ctx=[];let len=0;
 for(const s of scored.slice(0,8)){
  if(len>=maxChars)break;
  const t=s.text.length>9000?s.text.slice(0,9000)+'…':s.text;
  ctx.push({i:s.i,text:t});len+=t.length;
 }
 return ctx;
}

async function askModel(model,payload){
 const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
  method:'POST',
  headers:{
   'Content-Type':'application/json',
   'Authorization':'Bearer '+API_KEY,
   'HTTP-Referer':window.location.origin,
   'X-Title':'Archistudy Assistant'
  },
  body:JSON.stringify({
   model:model,
   temperature:0.2,
   messages:[
    {role:'system',content:SYS_INSTR},
    {role:'user',content:payload.userMessage}
   ]
  })
 });
 const data=await res.json();
 if(!res.ok||data.error){
  const msg=data.error?.message||('HTTP '+res.status);
  const err=new Error(msg);
  err.retryable=res.status===429||res.status>=500;
  throw err;
 }
 const text=data.choices?.[0]?.message?.content?.trim();
 if(!text){const err=new Error('Модель вернула пустой ответ.');err.retryable=false;throw err}
 return text;
}

function Bat(){return <svg viewBox="0 0 120 55" aria-hidden="true"><path d="M5 27 20 17l6 8 12-15 12 12 10-12 10 12 12-12 12 15 6-8 15 10-16 4-8 15-17-9-14 8-14-8-17 9-8-15z" fill="currentColor"/><circle cx="51" cy="25" r="2" fill="#071116"/><circle cx="69" cy="25" r="2" fill="#071116"/></svg>}

export default function BatAssistant(){
 const [open,setOpen]=useState(false),[q,setQ]=useState(''),[pages,setPages]=useState([]),
  [answer,setAnswer]=useState(''),[busy,setBusy]=useState(false),[sources,setSources]=useState([]);
 const formRef=useRef(null);
 useEffect(()=>{fetch(import.meta.env.BASE_URL+'course-material.txt').then(r=>r.text()).then(t=>setPages(t.split('\f'))).catch(()=>{})},[]);
 const refuse='Я — Bat assistant, помощник этого сайта. Отвечаю на вопросы по архитектуре, BIM, проектированию и материалам курса (вкладка «Материал»). Например: как работает арка, что такое BIM, как спланировать квартиру или какие бывают фундаменты.';
 const ask=async e=>{
  e.preventDefault();const question=q.trim();
  if(!question||busy)return;
  if(!SCORE.test(question)){setAnswer(refuse);setSources([]);return}
  if(!API_KEY){setAnswer('Не задан API-ключ. Создайте файл .env в корне проекта со строкой VITE_OPENROUTER_API_KEY=sk-or-v1-… и перезапустите dev-сервер.');setSources([]);return}
  setAnswer('');setBusy(true);setSources([]);
  try{
   const ctx=retrieve(pages,question);
   const overview=chapters.map(c=>`с.${c.page} ${c.title} — ${c.description}`).join('\n');
   const frags=ctx.map(s=>`=== СТРАНИЦА ${s.i} ===\n${s.text}`).join('\n\n---\n\n');
   const userMessage=[
    `ВОПРОС ПОЛЬЗОВАТЕЛЯ: ${question}`,
    `ОБЗОР МАТЕРИАЛА КУРСА (вкладка «Материал»):\n${overview}`,
    ctx.length
      ?`ФРАГМЕНТЫ МАТЕРИАЛА КУРСА:\n${frags}\n\nОтвечай по этим фрагментам и обзору курса; если в них ответа нет, но вопрос по архитектуре/BIM/проектированию — ответь из своих знаний и начни ответ с пометки «ℹ️ Ответ нейросети:».`
      :'Подходящих фрагментов в материале не найдено. Если вопрос по архитектуре/BIM/проектированию — ответь из своих знаний и начни ответ с пометки «ℹ️ Ответ нейросети:», пояснив, что это не из материала курса.'
   ].join('\n\n');
   const payload={userMessage};
   let lastErr=null;
   outer:for(const model of MODELS){
    for(let attempt=0;attempt<2;attempt++){
     try{
      const text=await askModel(model,payload);
      const finalText=ctx.length===0&&!/Ответ нейросети|информация от нейросети|не из материала курса/i.test(text)
       ?text+'\n\n(Ответ дан нейросетью — в материале курса этот вопрос не раскрыт.)'
       :text;
      setAnswer(finalText);setSources(ctx.map(s=>s.i));lastErr=null;break outer;
}catch(err){
     lastErr=err;
     if(!err.retryable||attempt===1||/no endpoints|not found/i.test(err.message)){continue outer}
     await sleep(900*(attempt+1));
    }
    }
   }
   if(lastErr){
    if(lastErr.retryable)setAnswer('Нейросеть временно перегружена (высокий спрос). Подождите несколько секунд и нажмите «Спросить» ещё раз. ('+lastErr.message+')');
    else setAnswer('Не удалось получить ответ от нейросети: '+lastErr.message);
   }
  }finally{setBusy(false)}
 };
 return <aside className={'bat-assistant '+(open?'open':'')}><button className="bat-toggle" onClick={()=>setOpen(v=>!v)} aria-label="Открыть помощника"><Bat/><span>Bat AI</span></button>{open&&<div className="bat-panel"><div className="bat-head"><Bat/><div><b>Bat assistant</b><small>архитектура и материалы сайта</small></div></div><p>Нейросеть отвечает на вопросы по архитектуре и по материалам этого сайта на основе учебного курса (вкладка «Материал»).</p><form ref={formRef} onSubmit={ask}><textarea value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();formRef.current?.requestSubmit();setQ('')}}} placeholder="Например: как работает арка? Из чего делают фундаменты?"/><button disabled={busy}>{busy?'Отвечаю…':'Спросить'}</button></form>{busy&&<div className="bat-typing"><i/><i/><i/> думаю по материалу курса</div>}{(answer||sources.length)&&<div className="bat-answer">{answer}{sources.length>0&&<small className="bat-sources">Источники: страницы {[...new Set(sources)].join(', ')}</small>}</div>}</div>}</aside>}
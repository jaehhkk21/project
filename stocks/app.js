import {stocks} from './data.js';
import {rankStocks} from './ranking.js';
const $=s=>document.querySelector(s);
let market='ALL', watchOnly=false,watch=new Set();
try{const saved=JSON.parse(localStorage.getItem('stock-lens-watch')||'[]');if(Array.isArray(saved))watch=new Set(saved.filter(s=>stocks.some(x=>x.symbol===s)));}catch{}
function detail(s){$('#detail-name').textContent=`${s.name} · ${s.symbol}`;$('#headline').textContent=s.headline;$('#summary').textContent=s.summary;$('#risk').textContent=s.risk;$('#detail').showModal();}
function render(){
 const style=$('#style').value;
 let rows=rankStocks(stocks,{market,sector:$('#sector').value,query:$('#query').value,style});if(watchOnly)rows=rows.filter(s=>watch.has(s.symbol));
 $('#watch-count').textContent=watch.size;$('#result-count').textContent=`${rows.length}개 종목`;
 $('#view-title').textContent=watchOnly?'저장한 관심 종목':'나에게 맞는 종목 찾기';
 $('#method').textContent={balanced:'균형형: 성장 35% · 수익성 30% · 모멘텀 35%를 반영합니다.',growth:'성장 중심: 성장 55% · 수익성 15% · 모멘텀 30%를 반영합니다.',defensive:'수익성 중심: 성장 20% · 수익성 60% · 모멘텀 20%를 반영합니다. 낮은 투자 위험을 보장하지 않습니다.'}[style]+' 각 지표는 0~100점으로 변환합니다. 성장=min(100,max(0,성장률×2)), 수익성=min(100,max(0,ROE×2.5)), 모멘텀=min(100,max(0,50+변동률×2))입니다.';
 $('#stocks').replaceChildren();
 for(const s of rows){const tr=document.createElement('tr');const name=document.createElement('td');const button=document.createElement('button');button.className='stock-name';button.textContent=s.name;button.addEventListener('click',()=>detail(s));const sub=document.createElement('small');sub.textContent=`${s.market} · ${s.symbol} · ${s.sector}`;name.append(button,sub);tr.append(name);
 for(const [i,val] of [s.score,`${s.growth}%`,`${s.roe}%`,`${s.momentum>0?'+':''}${s.momentum}%`].entries()){const td=document.createElement('td');td.textContent=val;td.className=i===0?'score':i===3?'positive':'';tr.append(td);}
 const td=document.createElement('td'),star=document.createElement('button');star.className='star';star.textContent=watch.has(s.symbol)?'★':'☆';star.setAttribute('aria-label',`${s.name} 관심 종목`);star.setAttribute('aria-pressed',watch.has(s.symbol));star.onclick=()=>{watch.has(s.symbol)?watch.delete(s.symbol):watch.add(s.symbol);try{localStorage.setItem('stock-lens-watch',JSON.stringify([...watch]));}catch{}render();};td.append(star);tr.append(td);$('#stocks').append(tr);}
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.className='empty';td.textContent=watchOnly?'저장된 종목이 없거나 필터에 맞는 종목이 없습니다. ☆를 눌러 관심 종목을 추가하세요.':'조건에 맞는 종목이 없습니다. 검색어나 필터를 변경해 주세요.';tr.append(td);$('#stocks').append(tr);}
}
document.querySelectorAll('[data-market]').forEach(b=>b.onclick=()=>{market=b.dataset.market;document.querySelectorAll('[data-market]').forEach(x=>x.classList.toggle('selected',x===b));render();});
for(const s of ['#query','#sector','#style'])$(s).addEventListener('input',render);
for(const [id,flag] of [['#all-view',false],['#watch-view',true]])$(id).onclick=()=>{watchOnly=flag;$('#all-view').classList.toggle('active',!flag);$('#watch-view').classList.toggle('active',flag);render();};
$('#close-detail').onclick=()=>$('#detail').close();render();

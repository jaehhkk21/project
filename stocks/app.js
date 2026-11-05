import {rankStocks,validateSnapshot,eligible} from './ranking.js?v=3';
const $=s=>document.querySelector(s);
let market='ALL',watchOnly=false,watch=new Set(),snapshot=null,busy=false,dirty=false;
try{const saved=JSON.parse(localStorage.getItem('stock-lens-watch')||'[]');if(Array.isArray(saved))watch=new Set(saved.filter(s=>typeof s==='string'));}catch{}
const date=t=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date(t));
const money=s=>`${new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(s.price)} ${s.currency||'(통화 미제공)'}`;
const key=s=>`${s.market}:${s.symbol}`;
const options=()=>({market,sector:$('#sector').value,query:$('#query').value,style:$('#style').value,peMode:$('#pe-mode').value});
function detail(s){
 $('#detail-name').textContent=`${s.name} · ${s.symbol}`;
 $('#headline').textContent=`선별 점수 ${s.score}점 · ${money(s)}`;
 $('#summary').textContent=`${s.peBasis==='FY_ESTIMATE'?'올해 예상 실적 기준 PER':'과거 12개월 실적 기준 PER'} ${s.pe.toFixed(2)}배, 52주 저가~고가 범위의 ${s.position.toFixed(1)}% 위치입니다. 최근 3개월 일평균 거래량은 ${Math.round(s.volume).toLocaleString('ko-KR')}주입니다. 가치 ${s.components.value.toFixed(1)} · 추세 ${s.components.position.toFixed(1)} · 거래량 순위 ${s.components.liquidity.toFixed(1)}점을 선택한 비중으로 합산했습니다. 가격 기준: ${date(s.priceTime*1000)} (한국 시각).`;
 $('#risk').textContent='저PER은 실적 악화의 신호일 수 있고, 높은 52주 위치는 과열 위험도 있습니다. 업종·거래소·통화 차이, 재무 데이터 갱신 지연과 유동성 위험을 확인하세요. 뉴스·공시·AI 분석 및 AI 기반 수익 예측은 반영하지 않았습니다. 예상 PER은 애널리스트 추정치가 바뀌거나 실적이 기대에 못 미칠 위험이 있습니다.';
 // Construct the URL from the symbol instead of trusting snapshot URLs.
 $('#source-link').href=`https://finance.yahoo.com/quote/${encodeURIComponent(s.symbol)}/`;
 $('#detail').showModal();
}
function method(){
 $('#method').textContent={balanced:'균형형: 가치 40% · 추세 40% · 거래량 20%.',value:'가치 중심: 가치 65% · 추세 20% · 거래량 15%.',trend:'추세 중심: 가치 20% · 추세 65% · 거래량 15%.'}[$('#style').value]+' 가치=100/(1+PER/20), 추세=(가격−52주 저가)/(52주 고가−저가)×100(0~100 제한), 거래량=같은 시장 내 3개월 평균 거래량의 백분위입니다. 필터 적용 전에 시장 전체에서 점수를 계산합니다.';
}
function empty(message){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.className='empty';td.textContent=message;tr.append(td);$('#stocks').replaceChildren(tr);$('#result-count').textContent='';}
function render(){
 method();$('#watch-count').textContent=watch.size;$('#view-title').textContent=watchOnly?'저장한 관심 종목':'나에게 맞는 종목 찾기';
 if(!snapshot){empty('추천받기를 누르면 실제 데이터에서 투자 후보를 찾아드립니다.');return;}
 let rows=rankStocks(snapshot.stocks,options());if(watchOnly)rows=rows.filter(s=>watch.has(key(s))||watch.has(s.symbol));
 const total=rows.length;rows=rows.slice(0,Number($('#limit').value));
 $('#result-count').textContent=`조건 일치 ${total.toLocaleString()}개 · 상위 ${rows.length}개`;
 $('#stocks').replaceChildren();
 for(const s of rows){const tr=document.createElement('tr'),td=document.createElement('td'),name=document.createElement('button'),sub=document.createElement('small');name.className='stock-name';name.textContent=s.name;name.onclick=()=>detail(s);sub.textContent=`${s.market} · ${s.symbol} · ${s.sector}`;td.append(name,sub);tr.append(td);
 for(const [i,val] of [s.score,money(s),s.pe.toFixed(2)+'배 ('+(s.peBasis==='FY_ESTIMATE'?'올해 예상':'실적')+')',s.position.toFixed(1)+'%'].entries()){const cell=document.createElement('td');cell.textContent=val;if(i===0)cell.className='score';tr.append(cell);}
 const cell=document.createElement('td'),star=document.createElement('button');star.className='star';const saved=watch.has(key(s))||watch.has(s.symbol);star.textContent=saved?'★':'☆';star.setAttribute('aria-label',`${s.name} 관심 종목`);star.setAttribute('aria-pressed',saved);star.onclick=()=>{if(saved){watch.delete(key(s));watch.delete(s.symbol);}else watch.add(key(s));try{localStorage.setItem('stock-lens-watch',JSON.stringify([...watch]));}catch{}render();};cell.append(star);tr.append(cell);$('#stocks').append(tr);}
 if(!rows.length)empty(watchOnly?'현재 조건에 맞는 관심 종목이 없습니다.':'조건에 맞고 지표가 충분한 종목이 없습니다. 시장·검색·업종 조건을 변경해 주세요.');
}
async function recommend(){
 if(busy)return;busy=true;dirty=false;$('#recommend').disabled=true;$('#recommend').textContent='분석 중…';$('#run-state').textContent='데이터 조회 중';$('#status').className='';$('#status').textContent='최신 데이터 파일을 불러와 전체 종목을 분석하고 있습니다.';$('#stocks').setAttribute('aria-busy','true');
 snapshot=null;empty('시장 데이터를 불러오는 중입니다…');
 $('#universe-count').textContent='—';$('#eligible-count').textContent='—';$('#data-time').textContent='조회 중';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch(`./data/market.json?t=${Date.now()}`,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(`시장 데이터 조회 실패 (HTTP ${response.status})`);
  const candidate=validateSnapshot(await response.json());
  // Keep selected sector when it still exists in the new snapshot.
  const sector=$('#sector').value;$('#sector').replaceChildren(new Option('모든 업종','ALL'));for(const name of [...new Set(candidate.stocks.map(s=>s.sector))].sort())$('#sector').add(new Option(name,name));if([...$('#sector').options].some(o=>o.value===sector))$('#sector').value=sector;
  snapshot=candidate;
  const valid=snapshot.stocks.filter(s=>eligible(s));
  $('#universe-count').textContent=snapshot.stocks.length.toLocaleString();$('#eligible-count').textContent=valid.length.toLocaleString();$('#data-time').textContent=date(snapshot.collectedAt);$('#run-state').textContent='분석 완료';
  const counts=['KR','US'].map(m=>`${m} ${snapshot.stocks.filter(s=>s.market===m).length.toLocaleString()}개`).join(' · ');
  $('#status').textContent=`${counts} 수집 · 지표 누락/PER≤0/가격 지연 등 ${snapshot.stocks.length-valid.length}개 제외. 수집 시각 ${date(snapshot.collectedAt)} (한국). 버튼은 최신 수집본을 분석하며, 실시간 시세 수집을 실행하지 않습니다. ${snapshot.scope}`;
  render();
 }catch(error){snapshot=null;$('#run-state').textContent='조회 실패';$('#data-time').textContent='확인 불가';$('#status').className='error';$('#status').textContent=error.name==='AbortError'?'응답 시간이 초과되었습니다. 연결을 확인하고 다시 시도해 주세요.':error.message;empty('실제 데이터를 확인하지 못해 추천을 표시하지 않습니다. 다시 시도해 주세요.');}
 finally{clearTimeout(timer);busy=false;$('#recommend').disabled=false;$('#recommend').textContent='✦ 다시 추천받기';$('#stocks').setAttribute('aria-busy','false');}
}
function changed(){method();if(snapshot){dirty=true;empty('추천 조건이 변경되었습니다. 추천받기를 눌러 다시 분석해 주세요.');$('#run-state').textContent='조건 변경';$('#status').textContent='변경한 조건으로 추천받기를 눌러 주세요.';}}
document.querySelectorAll('[data-market]').forEach(b=>b.onclick=()=>{market=b.dataset.market;document.querySelectorAll('[data-market]').forEach(x=>x.classList.toggle('selected',x===b));changed();});
for(const s of ['#query','#sector','#style','#limit','#pe-mode'])$(s).addEventListener('input',changed);
for(const [id,flag] of [['#all-view',false],['#watch-view',true]])$(id).onclick=()=>{watchOnly=flag;$('#all-view').classList.toggle('active',!flag);$('#watch-view').classList.toggle('active',flag);if(!dirty)render();};
$('#recommend').onclick=recommend;$('#close-detail').onclick=()=>$('#detail').close();render();

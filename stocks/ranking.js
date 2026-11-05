const DAY=86400000;
export function validateSnapshot(data, now=Date.now()) {
  if(data?.schemaVersion!==1 || !Array.isArray(data.stocks))throw new Error('데이터 형식이 올바르지 않습니다.');
  if(data.status!=='ready')throw new Error('실제 시장 데이터의 첫 수집이 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.');
  const time=Date.parse(data.collectedAt);
  if(!Number.isFinite(time)||time>now+300000||now-time>7*DAY)throw new Error('데이터가 7일 이상 오래되었거나 기준 시각이 잘못되었습니다. 데이터 갱신이 필요합니다.');
  if(!Array.isArray(data.coverage)||!data.coverage.length||data.coverage.some(c=>c.reported!==c.received))throw new Error('전체 페이지 수집을 확인할 수 없어 추천을 중단했습니다.');
  if(!data.stocks.length)throw new Error('조회된 종목이 없습니다.');
  const keys=new Set();
  for(const s of data.stocks){const key=`${s.market}:${s.symbol}`;if(!s.symbol||!['KR','US'].includes(s.market)||keys.has(key))throw new Error('종목 식별 데이터가 잘못되었습니다.');keys.add(key);}
  return data;
}
export function eligible(s, now=Date.now()) {
  return ['price','pe','low52','high52','volume','priceTime'].every(k=>Number.isFinite(s[k])) && s.price>0 && s.pe>0 && s.volume>0 && s.low52>0 && s.high52>s.low52 && s.priceTime*1000<=now+300000 && now-s.priceTime*1000<=7*DAY;
}
export function rankStocks(stocks,{market='ALL',sector='ALL',query='',style='balanced',peMode='all',now=Date.now()}={}) {
  const weights={balanced:[.4,.4,.2],value:[.65,.2,.15],trend:[.2,.65,.15]}[style]||[.4,.4,.2];
  const valid=stocks.filter(s=>eligible(s,now));
  const volumes={};
  for(const m of ['KR','US'])volumes[m]=valid.filter(s=>s.market===m).map(s=>s.volume).sort((a,b)=>a-b);
  const percentile=(array,n)=>{let lo=0,hi=array.length;while(lo<hi){const mid=(lo+hi)>>1;if(array[mid]<n)lo=mid+1;else hi=mid;}return array.length<=1?50:100*lo/(array.length-1);};
  return valid.map(s=>{
    const value=100/(1+s.pe/20),position=Math.min(100,Math.max(0,100*(s.price-s.low52)/(s.high52-s.low52))),liquidity=percentile(volumes[s.market],s.volume);
    return {...s,position,components:{value,position,liquidity},score:Math.round(value*weights[0]+position*weights[1]+liquidity*weights[2])};
  }).filter(s=>(peMode!=='ttm'||s.peBasis==='TTM')&&(market==='ALL'||s.market===market)&&(sector==='ALL'||s.sector===sector)&&`${s.name} ${s.symbol}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
}

export function rankStocks(stocks, {market='ALL', sector='ALL', query='', style='balanced'}={}) {
  const weights = {balanced:[.35,.3,.35],growth:[.55,.15,.3],defensive:[.2,.6,.2]}[style] || [.35,.3,.35];
  return stocks.filter(s => (market==='ALL'||s.market===market) && (sector==='ALL'||s.sector===sector) && `${s.name} ${s.symbol}`.toLowerCase().includes(query.toLowerCase())).map(s=> {
    const growth=Math.min(100,Math.max(0,s.growth*2));
    const quality=Math.min(100,Math.max(0,s.roe*2.5));
    const momentum=Math.min(100,Math.max(0,50+s.momentum*2));
    return {...s,score:Math.round(growth*weights[0]+quality*weights[1]+momentum*weights[2]),components:{growth,quality,momentum}};
  }).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
}

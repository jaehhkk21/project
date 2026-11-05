"""Fetch the complete Yahoo screener result for each configured exchange.
No API keys or fabricated fallback. Publish only a complete snapshot.
"""
import json
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path

EXCHANGES = {'KR': ['KSC', 'KOE'], 'US': ['ASE', 'BTS', 'CXI', 'NAE', 'NCM', 'NGM', 'NMS', 'NYQ', 'OEM', 'OQB', 'OQX', 'PCX', 'PNK', 'YHD']}


def number(value):
    if isinstance(value, dict):
        value = value.get('raw')
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def normalize(q, market):
    symbol = q.get('symbol')
    if not symbol or q.get('quoteType', 'EQUITY') != 'EQUITY':
        return None
    price = number(q.get('regularMarketPrice'))
    eps = number(q.get('epsTrailingTwelveMonths'))
    pe = number(q.get('trailingPE'))
    if pe is None and price is not None and eps and eps > 0:
        pe = price / eps
    pe_basis = 'TTM' if pe is not None and pe > 0 else None
    if pe is None:
        estimate = number(q.get('priceEpsCurrentYear'))
        eps_estimate = number(q.get('epsCurrentYear'))
        if estimate is None and price is not None and eps_estimate and eps_estimate > 0:
            estimate = price / eps_estimate
        if estimate is not None and estimate > 0:
            pe, pe_basis = estimate, 'FY_ESTIMATE'
    return {'symbol': symbol, 'name': q.get('longName') or q.get('shortName') or symbol,
            'market': market, 'exchange': q.get('exchange', ''),
            'sector': q.get('sector') or q.get('sectorDisp') or '미제공',
            'price': price, 'currency': q.get('currency'), 'pe': pe, 'peBasis': pe_basis,
            'low52': number(q.get('fiftyTwoWeekLow')), 'high52': number(q.get('fiftyTwoWeekHigh')),
            'volume': number(q.get('averageDailyVolume3Month')),
            'priceTime': number(q.get('regularMarketTime')),
            'sourceUrl': 'https://finance.yahoo.com/quote/' + symbol + '/'}


def collect_exchange(screen, query_class, market, exchange, pause=time.sleep):
    query = query_class('and', [query_class('eq', ['region', market.lower()]), query_class('eq', ['exchange', exchange])])
    offset, total, quotes, seen = 0, None, [], set()
    while total is None or offset < total:
        response = None
        for attempt in range(3):
            try:
                response = screen(query, offset=offset, size=250, sortField='ticker', sortAsc=True)
                if not isinstance(response, dict) or not isinstance(response.get('quotes'), list):
                    raise RuntimeError('Malformed provider response')
                break
            except Exception:
                if attempt == 2:
                    raise
                pause(5 * (attempt + 1))
        current_total = response.get('total')
        if not isinstance(current_total, int) or current_total < 0:
            raise RuntimeError(f'{exchange}: missing total')
        if total is not None and current_total != total:
            raise RuntimeError(f'{exchange}: universe changed during pagination; retry collection')
        total = current_total
        page = response['quotes']
        if not page and offset < total:
            raise RuntimeError(f'{exchange}: truncated response at {offset}/{total}')
        for q in page:
            key = q.get('symbol')
            if not key or key in seen:
                raise RuntimeError(f'{exchange}: missing or duplicate symbol; pagination incomplete')
            seen.add(key)
        quotes.extend(page)
        offset += len(page)
        if len(quotes) > total:
            raise RuntimeError(f'{exchange}: invalid pagination count')
        if offset < total:
            pause(1)
    return quotes, total


def main():
    import yfinance as yf
    rows, coverage = {}, []
    # Read the exchange universe from the installed provider version, never
    # mix hardcoded exchange codes from a different yfinance release.
    from yfinance.const import EQUITY_SCREENER_EQ_MAP
    exchange_map = EQUITY_SCREENER_EQ_MAP['exchange']
    for market in EXCHANGES:
        exchanges = sorted(exchange_map[market.lower()])
        if not exchanges:
            raise RuntimeError(f'{market}: no provider exchanges configured')
        for exchange in exchanges:
            quotes, total = collect_exchange(yf.screen, yf.EquityQuery, market, exchange)
            for q in quotes:
                row = normalize(q, market)
                if row:
                    rows[(market, row['symbol'])] = row
            coverage.append({'market': market, 'exchange': exchange, 'reported': total, 'received': len(quotes)})
            print(f'{market}/{exchange}: {len(quotes)}/{total}', flush=True)
    for market in EXCHANGES:
        count = sum(r['market'] == market for r in rows.values())
        if count < (1000 if market == 'KR' else 3000):
            raise RuntimeError(f'{market}: unexpected small universe ({count}); do not replace snapshot')
    now = time.time()
    quality = {}
    for market in EXCHANGES:
        selected = [row for row in rows.values() if row['market'] == market]
        complete = [row for row in selected if all(number(row.get(k)) is not None for k in ('price', 'pe', 'low52', 'high52', 'volume', 'priceTime')) and row['price'] > 0 and row['pe'] > 0 and row['volume'] > 0 and row['low52'] > 0 and row['high52'] > row['low52'] and now - 7 * 86400 <= row['priceTime'] <= now + 300]
        quality[market] = {'collected': len(selected), 'eligible': len(complete)}
        if not complete:
            raise RuntimeError(f'{market}: no stocks with valid recommendation metrics; refusing to publish')
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as handle:
            handle.write('## Real market snapshot\n\n| Market | Collected equities | Rankable equities |\n|---|---:|---:|\n')
            for market, counts in quality.items():
                handle.write(f"| {market} | {counts['collected']} | {counts['eligible']} |\n")
            print('::notice title=Real stock counts::' + json.dumps(quality), flush=True)
            handle.write('\nEvery provider-reported exchange page was collected. The universe is provider-defined, not independently reconciled to official listing rosters.\n')
    snapshot = {'schemaVersion': 1, 'status': 'ready', 'collectedAt': datetime.now(timezone.utc).isoformat(),
                'source': 'Yahoo Finance screener via yfinance', 'coverage': coverage, 'quality': quality,
                'scope': 'Yahoo Finance 한국·미국 거래소 스크리너에 등록된 주식. ETF·펀드 제외. 거래소 공식 전체 상장 목록과 대조하지 않았으므로 모든 상장 종목 포함을 보장하지 않습니다.',
                'stocks': sorted(rows.values(), key=lambda r: (r['market'], r['symbol']))}
    dest = Path(os.environ.get('SNAPSHOT_PATH', 'stocks/data/market.json'))
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    temp.replace(dest)
    print(f'Published {len(rows)} real stock records')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        import html
        # Public provider diagnostics only; this job uses no financial API secrets.
        message = f'{type(exc).__name__}: {str(exc)[:600]}'.replace('\n', ' ')
        print(f'::error title=Stock collection failed::{message}', flush=True)
        summary = os.environ.get('GITHUB_STEP_SUMMARY')
        if summary:
            with open(summary, 'a') as handle:
                handle.write('## Stock collection failed\n\n' + html.escape(message) + '\n')
        raise

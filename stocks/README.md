# Stock Lens — actual market screening

The browser's recommendation button fetches `data/market.json` and ranks the full collected universe before applying market/sector/search filters. It never substitutes demo rows when collection fails.

## Data workflow
`.github/workflows/stock-data.yml` runs on main-branch changes, manually in Actions, and weekdays at 22:35 UTC (07:35 Asia/Seoul the following day). GitHub schedule delivery can be delayed. It installs yfinance 0.2.66, pages through each supported Korean and US exchange in the Yahoo equity screener, tests completion against reported totals, and deploys the site and snapshot to GitHub Pages. No API credentials are stored in browser code. The fetched snapshot lives in the deployed Pages artifact, not in Git history. All exchanges must finish before deployment. The custom deployment runs only after collection succeeds. The job switches the Pages source to GitHub Actions to prevent legacy branch builds from deploying the bootstrap pending JSON; if the runtime token lacks this permission, change Settings > Pages > Source manually to GitHub Actions. the browser refuses snapshots over seven days old.

This is Yahoo's indexed universe, not an independently verified complete official exchange roster. It includes provider-supported US OTC exchanges. ETFs/funds are excluded; missing/unprofitable/stale stocks remain in the universe count but are excluded from ranking. Provider rate limits, pagination limits, universe changes, or unsupported exchanges fail the collection rather than silently truncating it. The source's delayed prices and fundamentals are not real-time data or investment advice. Verify provider terms before redistribution or commercial use.

## Scoring
Eligible rows require positive trailing P/E (or current-fiscal-year estimate P/E only when trailing P/E is absent; explicitly labelled and optionally excluded by the user), price and 3-month average share volume, a valid 52-week price range and a price timestamp no more than seven days old. Value = 100/(1+PE/20); trend = normalized position within 52-week low/high (clipped to 0–100); liquidity = within-market volume percentile. Balanced weights: 40/40/20; value 65/20/15; trend 20/65/15. News, AI-generated forecasts, commissions and industry valuation differences are not included.

## Validation
```
node --test stocks/ranking.test.js
python3 -m unittest discover -s stocks/scripts -p 'test_*.py'
```
Serve the checkout with `npm start` and navigate to `/stocks/`. Fresh data is created by a successful Actions deployment. To collect locally in an appropriately connected environment: `python -m pip install yfinance==0.2.66` then `python stocks/scripts/collect.py`. The committed pending JSON is a bootstrap state, not a validated recommendation dataset.

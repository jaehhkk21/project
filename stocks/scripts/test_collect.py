import unittest
from collect import collect_exchange, normalize

class CollectionTests(unittest.TestCase):
    def test_normalize_never_invents_missing_metrics(self):
        row = normalize({'symbol': 'A', 'regularMarketPrice': 10, 'epsTrailingTwelveMonths': 2}, 'US')
        self.assertEqual(row['pe'], 5)
        self.assertIsNone(row['high52'])
        self.assertIsNone(normalize({'symbol':'A','trailingPE':float('nan')},'US')['pe'])
        self.assertIsNone(normalize({'symbol':'ETF','quoteType':'ETF'},'US'))

    def test_estimates_are_explicit_and_do_not_hide_known_negative_pe(self):
        row = normalize({'symbol':'005930.KS','regularMarketPrice':100,'priceEpsCurrentYear':5},'KR')
        self.assertEqual(row['pe'],5)
        self.assertEqual(row['peBasis'],'FY_ESTIMATE')
        self.assertEqual(normalize({'symbol':'A','trailingPE':10},'US')['peBasis'],'TTM')
        self.assertEqual(normalize({'symbol':'B','trailingPE':-5,'priceEpsCurrentYear':5},'US')['pe'],-5)

    def test_paginates_entire_reported_universe(self):
        def fetch(q, offset, **kwargs):
            return {'total': 251, 'quotes': [{'symbol':str(i)} for i in range(offset,min(offset+250,251))]}
        rows,total=collect_exchange(fetch,lambda *args:args,'KR','KSC',lambda _:None)
        self.assertEqual(len(rows),251)
        self.assertEqual(total,251)

    def test_truncated_and_duplicate_pages_fail(self):
        for response in [{'total':2,'quotes':[]},{'total':2,'quotes':[{'symbol':'A'},{'symbol':'A'}]}]:
            with self.assertRaises(RuntimeError):
                collect_exchange(lambda *args,**kwargs:response,lambda *args:args,'US','NYQ',lambda _:None)

if __name__=='__main__':unittest.main()

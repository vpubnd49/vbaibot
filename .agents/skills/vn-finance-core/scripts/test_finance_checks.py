import unittest
from decimal import Decimal
from finance_checks import journal_totals, simple_interest, periodic_npv, closing_cash, number

def line(j,i,d,c,currency='VND',entity='E1'):
    return dict(entity_id=entity,journal_id=j,line_id=i,currency=currency,debit=d,credit=c)

class FinanceChecks(unittest.TestCase):
    def test_balanced_journal(self):
        rows=[line('J1','1','100','0'),line('J1','2','0','100')]
        self.assertTrue(journal_totals(rows)[0]['arithmetically_balanced'])
    def test_global_balance_does_not_hide_journal_errors(self):
        rows=[line('J1','1','100','0'),line('J2','1','0','100')]
        self.assertTrue(all(not r['arithmetically_balanced'] for r in journal_totals(rows)))
    def test_currencies_stay_separate(self):
        rows=[line('J1','1','100','0'),line('J1','2','0','100','USD')]
        self.assertEqual(len(journal_totals(rows)),2)
        self.assertTrue(all(not r['arithmetically_balanced'] for r in journal_totals(rows)))
    def test_duplicate_line_rejected(self):
        row=line('J1','1','100','0')
        with self.assertRaises(ValueError): journal_totals([row,row])
    def test_missing_amount_not_zero(self):
        with self.assertRaises(ValueError): journal_totals([line('J1','1',None,'100')])
    def test_invalid_values(self):
        for value in [None,True,0.1,'NaN','Infinity','']:
            with self.subTest(value=value),self.assertRaises(ValueError): number(value)
    def test_fixed_basis_interest(self):
        self.assertEqual(simple_interest('100000000','0.12',30,360),Decimal('1000000'))
    def test_basis_is_not_silently_changed(self):
        self.assertNotEqual(simple_interest('100000000','0.12',30,360),simple_interest('100000000','0.12',30,365))
    def test_invalid_basis(self):
        with self.assertRaises(ValueError): simple_interest('100','0.1',30,0)
    def test_npv_t0_and_zero_rate(self):
        self.assertEqual(periodic_npv(['-100','60','60'],'0'),Decimal('20'))
    def test_npv_discounting(self):
        self.assertEqual(periodic_npv(['-100','110'],'0.1'),Decimal('0'))
    def test_invalid_npv(self):
        with self.assertRaises(ValueError): periodic_npv(['100'],'-1')
    def test_cash_shortfall_is_preserved(self):
        self.assertEqual(closing_cash('100','50','200','0'),Decimal('-50'))
    def test_cash_missing_input(self):
        with self.assertRaises(ValueError): closing_cash('100',None,'20','0')

if __name__=='__main__': unittest.main()

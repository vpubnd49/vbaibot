from decimal import Decimal
import unittest
from finance_checks import progressive_amount

class MarginalTests(unittest.TestCase):
    bounds=['10000000','30000000','60000000','100000000',None]
    rates=['0.05','0.10','0.20','0.30','0.35']
    def test_known_values_and_boundaries(self):
        for base,expected in [('0','0'),('10000000','500000'),('30000000','2500000'),('40000000','4500000'),
                              ('60000000','8500000'),('100000000','20500000'),('120000000','27500000')]:
            with self.subTest(base=base):self.assertEqual(progressive_amount(base,self.bounds,self.rates),Decimal(expected))
    def test_one_dong_across_boundary(self):
        self.assertEqual(progressive_amount('10000001',self.bounds,self.rates)-progressive_amount('10000000',self.bounds,self.rates),Decimal('0.1'))
    def test_year_tiers_are_not_month_tiers(self):
        annual=['120000000','360000000','720000000','1200000000',None]
        self.assertEqual(progressive_amount('480000000',annual,self.rates),Decimal('54000000'))
    def test_missing_and_float_base(self):
        for base in [None,40000000.0,True,'NaN','-1']:
            with self.subTest(base=base),self.assertRaises(ValueError):progressive_amount(base,self.bounds,self.rates)
    def test_invalid_tiers(self):
        for bounds,rates in [(['10','10',None],['.1','.2','.3']),([None,'10'],['.1','.2']),(['10'],['.1']),
                             (['10',None],['10','.2']),(['10',None],['.1']),(['10',None],[True,'.1'])]:
            with self.subTest(bounds=bounds),self.assertRaises(ValueError):progressive_amount('5',bounds,rates)

if __name__=='__main__':unittest.main()

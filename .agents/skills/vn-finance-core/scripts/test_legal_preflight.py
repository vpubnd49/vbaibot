import copy
import unittest
from legal_preflight import preflight, payload_hash


def fixture():
    rule = dict(id='fixture', version='1', scope_key='VN/PIT/RESIDENT/SALARY',
        document=dict(status='PROMULGATED', issued_at='2025-12-10', effective_from='2026-07-01'),
        source=dict(url='https://vanban.chinhphu.vn/', evidence='PROVISION_READ', provision='Điều 29',
                    checked_at='2026-10-12', observed_at='2026-10-12'),
        application=dict(basis='TAX_YEAR', rule_effective_from='2026-01-01', tax_year_from=2026,
                         tax_year_to=None, tax_year_basis_verified=True),
        required_facts=['residency', 'taxable_income'], approval=dict(state='DRAFT'))
    case = dict(case_id='CASE-1',scope_key=rule['scope_key'], tax_year=2026, transaction_date='2026-01-20',
        facts=dict(residency='RESIDENT',taxable_income='40000000'), facts_verified=True, transition_resolved=True,
        legal_review=dict(case_id='CASE-1',scope_key=rule['scope_key'],state='COMPLETE',checked_at='2026-10-12',
                          reviewer='fixture-only',record_id='not-a-real-review',conflicts_resolved=True))
    return rule,case


class PreflightTests(unittest.TestCase):
    def setUp(self): self.rule,self.case=fixture()
    def run_case(self,**kwargs):return preflight(self.rule,self.case,'2026-10-12',**kwargs)
    def blocked(self,code,**kwargs):
        result=self.run_case(**kwargs);self.assertEqual(result['status'],'BLOCKED');self.assertIn(code,result['reasons'])
    def test_resident_salary_year_before_general_effective(self):
        self.assertEqual(self.run_case()['status'],'PREFLIGHT_PASSED')
    def test_no_compliance_claim(self):self.assertIs(self.run_case()['legal_compliance_certified'],False)
    def test_wrong_tax_year(self):self.case['tax_year']=2025;self.blocked('OUTSIDE_TAX_YEAR_APPLICATION')
    def test_bool_year(self):self.case['tax_year']=True;self.blocked('TAX_YEAR_MISSING_OR_INVALID')
    def test_unverified_year_basis(self):self.rule['application']['tax_year_basis_verified']=False;self.blocked('TAX_YEAR_BASIS_UNVERIFIED')
    def test_year_range(self):self.rule['application']['tax_year_to']=2025;self.blocked('APPLICATION_RANGE_INVALID')
    def test_future_law_execution(self):self.rule['document']['effective_from']='2026-12-01';self.blocked('FUTURE_RULE_AT_ASSESSMENT')
    def test_future_planning(self):
        self.rule['document']['effective_from']='2026-12-01';r=self.run_case(mode='planning')
        self.assertEqual(r['status'],'PLANNING_ONLY');self.assertIn('FUTURE_RULE_PLANNING_ONLY',r['notes'])
    def test_draft_document(self):self.rule['document']['status']='DRAFT';self.blocked('DOCUMENT_NOT_PROMULGATED')
    def test_metadata_not_provision(self):self.rule['source']['evidence']='METADATA_READ';self.blocked('PROVISION_NOT_READ')
    def test_nonofficial_host(self):self.rule['source']['url']='https://chinhphu.vn.evil.example/';self.blocked('OFFICIAL_SOURCE_MISSING')
    def test_stale_source(self):self.rule['source']['checked_at']='2026-08-01';self.blocked('SOURCE_CHECK_STALE')
    def test_future_source_check(self):self.rule['source']['checked_at']='2026-10-13';self.blocked('SOURCE_CHECK_FROM_FUTURE')
    def test_source_not_known(self):self.rule['source']['observed_at']='2026-10-13';self.blocked('SOURCE_NOT_KNOWN_AT_ASSESSMENT')
    def test_missing_income_is_not_zero(self):self.case['facts']['taxable_income']=None;self.blocked('REQUIRED_FACT_MISSING')
    def test_explicit_zero_is_data(self):self.case['facts']['taxable_income']='0';self.assertEqual(self.run_case()['status'],'PREFLIGHT_PASSED')
    def test_empty_requirements(self):self.rule['required_facts']=[];self.blocked('REQUIRED_FACTS_NOT_DEFINED')
    def test_case_mismatch(self):self.case['legal_review']['case_id']='ANOTHER';self.blocked('CASE_CHAIN_REVIEW_INCOMPLETE')
    def test_scope_mismatch(self):self.case['scope_key']='OTHER';self.blocked('SCOPE_MISMATCH')
    def test_transition_unresolved(self):self.case['transition_resolved']=False;self.blocked('TRANSITION_UNRESOLVED')
    def test_conflict(self):self.case['legal_review']['conflicts_resolved']=False;self.blocked('LEGAL_CONFLICT_UNRESOLVED')
    def test_not_approved(self):self.blocked('RULE_NOT_APPROVED',mode='production')
    def approve(self):
        self.rule['approval']=dict(state='APPROVED',approver='fixture-only',record_id='fixture-approval',
                                   approved_at='2026-10-12',payload_sha256=payload_hash(self.rule))
    def test_approved_payload(self):self.approve();self.assertEqual(self.run_case(mode='production')['status'],'PREFLIGHT_PASSED')
    def test_edit_after_approval(self):self.approve();self.rule['version']='2';self.blocked('APPROVAL_PAYLOAD_MISMATCH',mode='production')
    def test_fiscal_start_before_threshold(self):
        self.rule['application']=dict(basis='FISCAL_YEAR_START',rule_effective_from='2026-01-01')
        self.case['fiscal_year_start']='2025-07-01';self.blocked('BEFORE_RULE_APPLICATION')
    def test_fiscal_start_after_threshold(self):
        self.rule['application']=dict(basis='FISCAL_YEAR_START',rule_effective_from='2026-01-01')
        self.case['fiscal_year_start']='2026-07-01';self.assertEqual(self.run_case()['status'],'PREFLIGHT_PASSED')
    def test_missing_application_date(self):
        self.rule['application']=dict(basis='FISCAL_YEAR_START',rule_effective_from='2026-01-01')
        self.blocked('APPLICATION_DATE_MISSING_OR_INVALID')
    def test_application_end(self):
        self.rule['application']=dict(basis='TRANSACTION_DATE',rule_effective_from='2026-01-01',rule_effective_to='2026-01-19')
        self.blocked('AFTER_RULE_APPLICATION')
    def test_unsupported_contract_needs_explicit_implementation(self):
        self.rule['application']['basis']='CONTRACT_TRANSITION';self.blocked('UNSUPPORTED_APPLICATION_BASIS')
    def test_verified_exception_to_general_effective_date(self):
        self.rule['application'].update(rule_effective_exception_verified=True,separate_effective_basis='Điều 29(2)')
        self.rule['source'].update(checked_at='2026-01-15',observed_at='2026-01-15')
        self.case['legal_review']['checked_at']='2026-01-15'
        self.assertEqual(preflight(self.rule,self.case,'2026-01-15')['status'],'PREFLIGHT_PASSED')
    def test_unverified_effective_exception_is_blocked(self):
        self.rule['document']['effective_from']='2026-12-01'
        self.rule['application']['rule_effective_exception_verified']=True
        self.blocked('FUTURE_RULE_AT_ASSESSMENT')
    def test_old_approval_unchanged_payload(self):
        self.approve();self.rule['approval']['approved_at']='2026-07-01'
        self.assertEqual(self.run_case(mode='production')['status'],'PREFLIGHT_PASSED')
    def test_invalid_mode(self):
        with self.assertRaises(ValueError):self.run_case(mode='autoapprove')
    def test_invalid_freshness(self):
        with self.assertRaises(ValueError):self.run_case(max_age_days=True)

if __name__=='__main__':unittest.main()

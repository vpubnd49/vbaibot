#!/usr/bin/env python3
"""Offline configuration preflight; never establishes legal correctness or approval."""
import argparse
import hashlib
import json
from datetime import date
from urllib.parse import urlparse


def iso_day(value):
    if not isinstance(value, str):
        raise ValueError('An ISO date string is required')
    result = date.fromisoformat(value)
    if result.isoformat() != value:
        raise ValueError('Use YYYY-MM-DD')
    return result


def payload_hash(rule):
    """Approval binds all rule data except the approval record itself."""
    payload = {k: v for k, v in rule.items() if k != 'approval'}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False,
                                   separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def preflight(rule, case, assessed_at, mode='analysis', max_age_days=30):
    """Validate explicit records. COMPLETE/APPROVED must come from real workflow.

    Modes: analysis checks scoped calculation readiness; production additionally
    checks an approval tied to the current payload; planning cannot authorize use.
    max_age_days is sample internal policy, not a statutory freshness guarantee.
    """
    if mode not in ('analysis', 'production', 'planning'):
        raise ValueError('Unknown mode')
    if isinstance(max_age_days, bool) or not isinstance(max_age_days, int) or max_age_days < 0:
        raise ValueError('Invalid freshness policy')
    if not isinstance(rule, dict) or not isinstance(case, dict):
        raise ValueError('Rule and case must be objects')
    today = iso_day(assessed_at)
    errors, notes = [], []
    def problem(code):
        if code not in errors:
            errors.append(code)
    def day(value, code):
        try:
            return iso_day(value)
        except (ValueError, TypeError):
            problem(code)
            return None
    def checked(value, prefix):
        d = day(value, prefix + '_DATE_MISSING_OR_INVALID')
        if d:
            if d > today: problem(prefix + '_FROM_FUTURE')
            elif (today - d).days > max_age_days: problem(prefix + '_STALE')
        return d

    for k in ('id', 'version', 'scope_key'):
        if not isinstance(rule.get(k), str) or not rule[k].strip():
            problem('RULE_ID_VERSION_SCOPE_MISSING')
    if not isinstance(case.get('case_id'), str) or not case['case_id'].strip():
        problem('CASE_ID_MISSING')
    if not case.get('scope_key') or case.get('scope_key') != rule.get('scope_key'):
        problem('SCOPE_MISMATCH')
    doc = rule.get('document')
    if not isinstance(doc, dict): doc = {}
    if doc.get('status') != 'PROMULGATED': problem('DOCUMENT_NOT_PROMULGATED')
    issued = day(doc.get('issued_at'), 'ISSUED_DATE_MISSING_OR_INVALID')
    document_effective = day(doc.get('effective_from'), 'DOCUMENT_EFFECTIVE_DATE_MISSING_OR_INVALID')
    if issued and issued > today: problem('NOT_ISSUED_AT_ASSESSMENT')

    source = rule.get('source')
    if not isinstance(source, dict): source = {}
    hostname = urlparse(source.get('url') if isinstance(source.get('url'), str) else '').hostname or ''
    url = source.get('url', '')
    official = (hostname.endswith('.gov.vn') or hostname.endswith('.chinhphu.vn')
                or hostname in ('chinhphu.vn', 'vbpl.vn') or hostname.endswith('.vbpl.vn'))
    if not isinstance(url, str) or not url.startswith('https://') or not official:
        problem('OFFICIAL_SOURCE_MISSING')
    if source.get('evidence') not in ('PROVISION_READ', 'VERIFIED_FOR_CASE'):
        problem('PROVISION_NOT_READ')
    if not isinstance(source.get('provision'), str) or not source['provision'].strip():
        problem('PROVISION_MISSING')
    checked(source.get('checked_at'), 'SOURCE_CHECK')
    observed = day(source.get('observed_at'), 'OBSERVED_DATE_MISSING_OR_INVALID')
    if observed and observed > today: problem('SOURCE_NOT_KNOWN_AT_ASSESSMENT')
    if observed and issued and observed < issued: problem('OBSERVED_BEFORE_ISSUE')

    review = case.get('legal_review')
    if not isinstance(review, dict): review = {}
    if (review.get('state') != 'COMPLETE' or review.get('scope_key') != rule.get('scope_key')
            or review.get('case_id') != case.get('case_id') or not review.get('reviewer')
            or not review.get('record_id')):
        problem('CASE_CHAIN_REVIEW_INCOMPLETE')
    checked(review.get('checked_at'), 'CASE_REVIEW')
    if review.get('conflicts_resolved') is not True: problem('LEGAL_CONFLICT_UNRESOLVED')
    if case.get('facts_verified') is not True: problem('FACTS_NOT_VERIFIED')
    if case.get('transition_resolved') is not True: problem('TRANSITION_UNRESOLVED')
    requirements = rule.get('required_facts')
    facts = case.get('facts')
    if not isinstance(requirements, list) or not requirements or any(
            not isinstance(k, str) or not k.strip() for k in requirements):
        problem('REQUIRED_FACTS_NOT_DEFINED')
    elif not isinstance(facts, dict) or any(facts.get(k) in (None, '', [], {}) for k in requirements):
        problem('REQUIRED_FACT_MISSING')

    application = rule.get('application')
    if not isinstance(application, dict): application = {}
    basis = application.get('basis')
    rule_effective = day(application.get('rule_effective_from'), 'RULE_EFFECTIVE_DATE_MISSING_OR_INVALID')
    document_is_future = bool(document_effective and document_effective > today)
    rule_is_future = bool(rule_effective and rule_effective > today)
    effective_exception = (application.get('rule_effective_exception_verified') is True
                           and isinstance(application.get('separate_effective_basis'), str)
                           and bool(application['separate_effective_basis'].strip())
                           and rule_effective is not None and rule_effective <= today)
    if (document_is_future and not effective_exception) or rule_is_future:
        if mode == 'planning': notes.append('FUTURE_RULE_PLANNING_ONLY')
        else: problem('FUTURE_RULE_AT_ASSESSMENT')
    if basis in ('TRANSACTION_DATE', 'FISCAL_YEAR_START'):
        field = 'transaction_date' if basis == 'TRANSACTION_DATE' else 'fiscal_year_start'
        event = day(case.get(field), 'APPLICATION_DATE_MISSING_OR_INVALID')
        if event and rule_effective and event < rule_effective: problem('BEFORE_RULE_APPLICATION')
        end = application.get('rule_effective_to')
        if end is not None:
            last = day(end, 'APPLICATION_END_INVALID')
            if last and rule_effective and last < rule_effective: problem('APPLICATION_RANGE_INVALID')
            if event and last and event > last: problem('AFTER_RULE_APPLICATION')
    elif basis == 'TAX_YEAR':
        year, lower, upper = case.get('tax_year'), application.get('tax_year_from'), application.get('tax_year_to')
        valid_year = lambda n: isinstance(n, int) and not isinstance(n, bool) and 1900 <= n <= 9999
        if not valid_year(year) or not valid_year(lower) or (upper is not None and not valid_year(upper)):
            problem('TAX_YEAR_MISSING_OR_INVALID')
        elif upper is not None and upper < lower: problem('APPLICATION_RANGE_INVALID')
        elif year < lower or (upper is not None and year > upper): problem('OUTSIDE_TAX_YEAR_APPLICATION')
        if application.get('tax_year_basis_verified') is not True:
            problem('TAX_YEAR_BASIS_UNVERIFIED')
    else:
        problem('UNSUPPORTED_APPLICATION_BASIS')

    digest = payload_hash(rule)
    if mode == 'production':
        approval = rule.get('approval')
        if not isinstance(approval, dict): approval = {}
        if approval.get('state') != 'APPROVED' or not approval.get('approver') or not approval.get('record_id'):
            problem('RULE_NOT_APPROVED')
        if approval.get('payload_sha256') != digest: problem('APPROVAL_PAYLOAD_MISMATCH')
        approved_day = day(approval.get('approved_at'), 'APPROVAL_DATE_MISSING_OR_INVALID')
        if approved_day and approved_day > today: problem('APPROVAL_FROM_FUTURE')
    if mode == 'planning':
        status = 'PLANNING_ONLY' if not errors else 'BLOCKED'
    else:
        status = 'PREFLIGHT_PASSED' if not errors else 'BLOCKED'
    return {'status': status, 'mode': mode, 'assessed_at': assessed_at, 'case_id': case.get('case_id'),
            'rule_id': rule.get('id'), 'rule_payload_sha256': digest, 'reasons': errors, 'notes': notes,
            'legal_compliance_certified': False,
            'notice': 'Only checks supplied configuration records; does not verify law, facts, reviewer authority or signatures.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input_json', help='Object with rule, case, assessed_at, optional mode/max_age_days')
    args = parser.parse_args()
    with open(args.input_json, encoding='utf-8') as f: data = json.load(f)
    result = preflight(**data)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['status'] in ('PREFLIGHT_PASSED', 'PLANNING_ONLY') else 2

if __name__ == '__main__':
    raise SystemExit(main())

#!/usr/bin/env python3
"""Small deterministic arithmetic helpers. No live tax/accounting rules or network access."""
import argparse
import json
from decimal import Decimal, InvalidOperation, localcontext

def number(value):
    if isinstance(value, (float, bool)) or value is None:
        raise ValueError('Use an integer or decimal string; floats, bools and missing values are rejected')
    try:
        result = Decimal(value)
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError('Invalid decimal value') from exc
    if not result.is_finite():
        raise ValueError('Non-finite value')
    return result

def journal_totals(lines):
    """Group each journal by entity and ledger currency; balance does not establish validity."""
    if not lines:
        raise ValueError('No journal lines')
    groups, seen = {}, set()
    for line in lines:
        key = tuple(line.get(k) for k in ('entity_id','journal_id','currency'))
        line_id = line.get('line_id')
        if not all(isinstance(v, str) and v.strip() for v in key + (line_id,)):
            raise ValueError('Missing entity, journal, currency or line ID')
        identity = key + (line_id,)
        if identity in seen:
            raise ValueError('Duplicate line ID')
        seen.add(identity)
        debit, credit = number(line.get('debit')), number(line.get('credit'))
        if debit < 0 or credit < 0 or (debit > 0 and credit > 0) or debit == credit == 0:
            raise ValueError('Each line needs exactly one positive debit or credit')
        totals = groups.setdefault(key, [Decimal(0), Decimal(0)])
        totals[0] += debit
        totals[1] += credit
    return [{'entity_id':k[0], 'journal_id':k[1], 'currency':k[2],
             'debit':str(v[0]), 'credit':str(v[1]), 'difference':str(v[0]-v[1]),
             'arithmetically_balanced':v[0] == v[1]} for k,v in sorted(groups.items())]

def simple_interest(principal, annual_rate, days, basis):
    """One constant-balance, constant-rate segment; caller supplies contractual day count."""
    p,r,d,b = map(number, (principal,annual_rate,days,basis))
    if p < 0 or d < 0 or d != d.to_integral_value() or b <= 0 or b != b.to_integral_value():
        raise ValueError('Invalid principal, days or year basis')
    with localcontext() as ctx:
        ctx.prec = 40
        return p*r*d/b

def periodic_npv(cashflows, period_rate):
    """Equal intervals, CF[0] at t=0; not XNPV or investment advice."""
    if not cashflows:
        raise ValueError('No cash flows')
    r = number(period_rate)
    if r <= -1:
        raise ValueError('Rate must exceed -1')
    flows = list(map(number,cashflows))
    with localcontext() as ctx:
        ctx.prec = 40
        return sum((c/(1+r)**t for t,c in enumerate(flows)), Decimal(0))

def closing_cash(opening, receipts, payments, net_financing):
    o,r,p,f = map(number,(opening,receipts,payments,net_financing))
    if r < 0 or p < 0:
        raise ValueError('Receipts/payments must be nonnegative; financing is signed')
    return o+r-p+f

def progressive_amount(taxable_base, upper_bounds, rates):
    """Marginal arithmetic using caller-supplied tiers, not an authoritative tax rule.

    Bounds are increasing cumulative amounts, with None only for the last tier.
    Rates are fractions, not percent points. Input must already be taxable base.
    """
    base = number(taxable_base)
    if base < 0 or not upper_bounds or len(upper_bounds) != len(rates) or upper_bounds[-1] is not None:
        raise ValueError('Invalid base or tiers; last tier must be open-ended')
    lower, total = Decimal(0), Decimal(0)
    with localcontext() as ctx:
        ctx.prec = 40
        for i, (raw_upper, raw_rate) in enumerate(zip(upper_bounds, rates)):
            rate = number(raw_rate)
            if not 0 <= rate <= 1:
                raise ValueError('Rates must be fractions between 0 and 1')
            if raw_upper is None:
                if i != len(upper_bounds)-1:
                    raise ValueError('Only last tier may be open-ended')
                upper = None
            else:
                upper = number(raw_upper)
                if upper <= lower:
                    raise ValueError('Bounds must be positive and strictly increasing')
            amount = max(Decimal(0), (base if upper is None else min(base, upper)) - lower)
            total += amount * rate
            if upper is not None:
                lower = upper
        return total

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation',choices=['journal','interest','npv','cash','progressive'])
    parser.add_argument('input_json',help='UTF-8 JSON file; monetary/rate inputs as decimal strings')
    args=parser.parse_args()
    with open(args.input_json,encoding='utf-8') as f:
        data=json.load(f)
    with localcontext() as ctx:
        ctx.prec=40
        if args.operation=='journal': result=journal_totals(data['lines'])
        elif args.operation=='interest': result=str(simple_interest(**data))
        elif args.operation=='npv': result=str(periodic_npv(**data))
        elif args.operation=='cash': result=str(closing_cash(**data))
        else: result=str(progressive_amount(**data))
    print(json.dumps({'operation':args.operation,'result':result,'status':'ARITHMETIC_ONLY'},ensure_ascii=False))

if __name__=='__main__':
    main()

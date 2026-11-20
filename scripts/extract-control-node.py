"""Read the source XLSX without editing it; capture node 1 and check geometry caches.

Run: python scripts/extract-control-node.py
Uses the Python standard library only. This is not an Excel recalculation engine.
"""
import hashlib
import json
import math
import posixpath
from pathlib import Path
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Насос 600В-1,6_100.xlsx'
OUTPUT = ROOT / 'tests' / 'fixtures' / 'control-node-1.json'
NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'


def main():
    before = SOURCE.read_bytes()
    with ZipFile(SOURCE) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        relations = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        all_sheets = {}
        for sheet in workbook.find('x:sheets', NS):
            if sheet.attrib['name'] not in [f'Вузол №{index}' for index in range(1,5)]:
                continue
            target = next(item.attrib['Target'] for item in relations if item.attrib['Id'] == sheet.attrib[f'{{{REL}}}id'])
            target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            records = {}
            for cell in ET.fromstring(archive.read(target)).findall('.//x:sheetData/x:row/x:c', NS):
                raw = cell.find('x:v', NS)
                value = raw.text if raw is not None else None
                kind = cell.attrib.get('t')
                if kind == 's':
                    value = strings[int(value)] if value is not None else None
                elif kind == 'inlineStr':
                    value = ''.join(cell.find('x:is', NS).itertext())
                elif kind == 'b':
                    value = value == '1'
                elif kind not in ('str', 'e') and value is not None:
                    value = float(value)
                formula = cell.find('x:f', NS)
                records[cell.attrib['r']] = {'value': value, 'formula': '=' + (formula.text or '') if formula is not None else None}
            all_sheets[sheet.attrib['name']] = records
        cells = all_sheets['Вузол №1']

    def value(address):
        return cells[address]['value']

    outer, inner, hole, count = (value(key) for key in ['F20', 'F21', 'F23', 'C40'])
    width = (outer - inner) / 2
    effective = 3.8 * math.sqrt(width) if width > 15 else width
    mean = (outer + inner) / 2
    d, pitch, axial_hole = (value(key) for key in ['C34', 'C37', 'C36'])
    root_diameter = d - 2 * (17 / 24) * (0.5 * pitch * math.tan(math.radians(60)))
    checks = {
        'C16': width,
        'C17': width - hole,
        'C18': effective,
        # The source condition is C16 > 15, including the C19 formula.
        'C19': 3.8 * math.sqrt(width - hole) if width > 15 else width - hole,
        'F22': mean,
        'C22': math.pi * (effective * mean - count * hole ** 2 / 4),
        'C23': math.pi * ((outer + inner) / 4) ** 2,
        'C33': root_diameter,
        'C35': d - 2 * (3 / 8) * (0.5 * pitch * math.tan(math.radians(60))),
        'C38': value('C87') + value('C15') + value('C60'),
        'C39': value('C98') + value('C80'),
        # Preserve 0.785 from Excel; do not silently replace with pi/4.
        'C47': 0.785 * (d ** 2 - axial_hole ** 2),
        'C48': 0.785 * (root_diameter ** 2 - axial_hole ** 2),
        'C89': math.pi * (width * mean - count * hole ** 2 / 4),
    }
    verification = []
    for address, recomputed in checks.items():
        cached = value(address)
        if not math.isclose(cached, recomputed, rel_tol=1e-11, abs_tol=1e-9):
            raise ValueError(f'{address}: saved cache {cached} != independent geometry calculation {recomputed}')
        verification.append({'cell': address, 'formula': cells[address]['formula'], 'savedValue': cached, 'independentlyCalculatedValue': recomputed})

    compliance_checks = []
    for result_column, input_column in [('I', 'C'), ('J', 'D')]:
        e_fastener = value(input_column + '45')
        terms = {
            4: value('C15') / (value(input_column + '24') * value('C22')),
            8: value('C60') / (value('C63') * value(input_column + '64') * 3.1415 * value('C61') * value('C62')),
            10: value('C99') / (value(input_column + '94') * value('C101')),
            11: value('C87') / (value(input_column + '85') * value('C89')),
            13: 0.49 * math.sqrt(1.44 + 9.28 * value('C37') / value('C33')) / (value('C35') * e_fastener),
            15: value('C38') / (e_fastener * value('C47')),
            16: value('C39') / (e_fastener * value('C48')),
        }
        terms[14] = terms[13]
        terms[17] = (terms[15] + terms[13] + terms[14] + terms[16]) / count if value('C38') < 6 * value('C34') else terms[15] / count
        # I5/I6/I7/I9/I12 and J counterparts are inactive (saved zero) in node 1.
        for row in (5, 6, 7, 9, 12):
            if value(result_column + str(row)) != 0:
                raise ValueError('Control node has an active optional component; update independent compliance checks.')
        terms[18] = terms[4] / sum(terms[row] for row in (4, 8, 10, 11, 17))
        for row, recomputed in terms.items():
            address = result_column + str(row)
            cached = value(address)
            if not math.isclose(cached, recomputed, rel_tol=1e-11, abs_tol=1e-15):
                raise ValueError(f'{address}: saved compliance cache {cached} != independent value {recomputed}')
            compliance_checks.append({'cell': address, 'formula': cells[address]['formula'], 'savedValue': cached, 'independentlyCalculatedValue': recomputed})

    thermal_values = {
        'C28': value('C15') * value('C27') * (value('C5') - 20) * 1e-6,
        'C66': value('C60') * value('C65') * (value('C5') - 20) * 1e-6,
        'C88': value('C87') * value('C86') * (value('C5') - 20) * 1e-6,
        'C100': value('C99') * value('C95') * (value('C5') - 20) * 1e-6,
    }
    thermal_values['I23'] = sum(value(address) for address in ('C28', 'C66', 'C75', 'C88', 'C109'))
    for column in ('I', 'J'):
        total = sum(value(column + str(row)) for row in (4, 10, 11, 17, 5, 6, 7, 8, 9))
        thermal_values[column + '32'] = (value(column + '23') - value(column + '22')) / total
    thermal_checks = []
    for address, recomputed in thermal_values.items():
        cached = value(address)
        if not math.isclose(cached, recomputed, rel_tol=1e-11, abs_tol=1e-15):
            raise ValueError(f'{address}: saved thermal cache {cached} != independent value {recomputed}')
        thermal_checks.append({'cell': address, 'formula': cells[address]['formula'], 'savedValue': cached, 'independentlyCalculatedValue': recomputed})

    force_checks = []
    for column, inputs in [('I','C'),('J','D')]:
        terms = {27:value('C6') / (value('C41') * value('C34')),
                 29:value('C22') * value(inputs+'21') * value(inputs+'4'),
                 30:value('C23') * value(inputs+'4'),
                 31:value('C22') * value(inputs+'20')}
        terms[28] = terms[27] * count
        terms[33] = terms[28] + value(column+'18') * terms[30] + value(column+'32')
        terms[34] = terms[28] - (1-value(column+'18')) * terms[30] + value(column+'32')
        terms[43] = terms[29] + (1-value(column+'18')) * terms[30] + value(column+'32')
        terms[44] = terms[34] / value('C22')
        for row,recomputed in terms.items():
            address = column + str(row)
            cached = value(address)
            if not math.isclose(cached,recomputed,rel_tol=1e-11,abs_tol=1e-9):
                raise ValueError(f'{address}: force cache {cached} != independent value {recomputed}')
            force_checks.append({'cell':address,'formula':cells[address]['formula'],'savedValue':cached,'independentlyCalculatedValue':recomputed})
    lower = {'N52':value('I31'),'N53':value('I43'),'O53':value('J43')}
    for column,inputs,result in [('I','C','N55'),('J','D','O55')]:
        lower[result] = value(inputs+'25') * value('C22') + (1-value(column+'18')) * value(column+'30') - value(column+'32')
    lower['N57'] = max(lower.values())
    lower['N58'] = lower['N57'] * value('C41') * value('C34') / (count * 1000)
    for address,recomputed in lower.items():
        cached = value(address)
        if not math.isclose(cached,recomputed,rel_tol=1e-11,abs_tol=1e-9):
            raise ValueError(f'{address}: minimum cache {cached} != independent value {recomputed}')
        force_checks.append({'cell':address,'formula':cells[address]['formula'],'savedValue':cached,'independentlyCalculatedValue':recomputed})

    strength_checks = []
    strength_values = {'C32':value('I27') * value('C42') * value('C33')}
    for column,inputs,forces_column in [('N','C','I'),('O','D','J')]:
        rp = value(inputs+'51')
        allowable = rp / 2 if column == 'N' else 0.7 * rp
        terms = {4:(value(forces_column+'28') + value(forces_column+'18') * value(forces_column+'30')) / (value('C47') * count),
                 5:allowable,
                 13:strength_values['C32'] / (0.196 * (d**4 - axial_hole**4) / d),
                 14:rp / 4}
        terms[6] = terms[5] / terms[4]
        terms[15] = terms[14] / terms[13]
        if column == 'N':
            terms[7] = value('I33') / (value('C47') * count)
            terms[8] = terms[5] * 1.3
            terms[9] = terms[8] / terms[7]
            terms[10] = math.sqrt(terms[7]**2 + 4 * terms[13]**2)
            terms[11] = terms[5] * 1.7
            terms[12] = terms[11] / terms[10]
        for stress_row,h,k1,km,diameter,part_rp,body in [
            (23,value('C80'),value('C43'),value('C44'),value('C33'),rp,False),
            (30,value('C98'),value('C43'),value('C97'),value('C33'),rp,False),
            (37,value('C80'),value('C78'),value('C79'),d,value(inputs+'82'),False),
            (44,value('C98'),value('C96'),value('C97'),d,value(inputs+'103'),True),
        ]:
            terms[stress_row] = value(forces_column+'33') / (math.pi * diameter * h * count * k1 * km)
            terms[stress_row+1] = part_rp * 0.32 if column == 'N' or body else part_rp * 0.25
            terms[stress_row+2] = terms[stress_row+1] / terms[stress_row]
        strength_values.update({column+str(row):result for row,result in terms.items()})
    for address,recomputed in strength_values.items():
        cached = value(address)
        if not math.isclose(cached,recomputed,rel_tol=1e-11,abs_tol=1e-9):
            raise ValueError(f'{address}: strength cache {cached} != independent value {recomputed}')
        strength_checks.append({'cell':address,'formula':cells[address]['formula'],'savedValue':cached,'independentlyCalculatedValue':recomputed})

    maximum_checks = []
    maximum_values = {}
    for column,forces_column in [('N','I'),('O','J')]:
        pressure_load = value(forces_column+'18') * value(forces_column+'30')
        thermal = value(forces_column+'32')
        base = value(column+'5') * count * value('C47') - pressure_load
        maximum_values[column+'66'] = base
        maximum_values[column+'67'] = base + thermal if column == 'N' else base - thermal
        for row,allowance,height,k1,km,diameter in [
            (71,24,20,21,22,value('C33')),
            (72,31,27,28,29,value('C33')),
            (73,38,34,35,36,d),
            (74,45,41,42,43,d),
        ]:
            maximum_values[column+str(row)] = value(column+str(allowance)) * math.pi * diameter * value(column+str(height)) * count * value(column+str(k1)) * value(column+str(km)) - pressure_load - thermal
    # Historical full Excel minimum also includes any numeric flange constraints.
    historical_candidates = [value(column+str(row)) for column in ('N','O') for row in (66,67,68,69,71,72,73,74,76,77,78,80,81,82)]
    maximum_values['N83'] = min(item for item in historical_candidates if isinstance(item,(int,float)))
    maximum_values['N84'] = maximum_values['N83'] * value('C41') * d / (count * 1000)
    maximum_values['P89'] = math.floor(maximum_values['N84'])
    for address,recomputed in maximum_values.items():
        cached = value(address)
        if not math.isclose(cached,recomputed,rel_tol=1e-11,abs_tol=1e-9):
            raise ValueError(f'{address}: maximum cache {cached} != independent value {recomputed}')
        maximum_checks.append({'cell':address,'formula':cells[address]['formula'],'savedValue':cached,'independentlyCalculatedValue':recomputed})

    flange_cases = []
    flange_checks = 0
    for sheet_name,records in all_sheets.items():
        source = lambda address: records.get(address,{}).get('value')
        for side,col,hydro_col,rm_row,rp_row,name_row in [('sideA','W','X',90,91,84),('sideB','R','S',102,103,93)]:
            if not isinstance(source(col+'4'),(int,float)):
                continue
            cast_iron = 'сч' in str(source('C'+str(name_row))).lower()
            geometry = dict(zip(['innerDiameter','boltCircle','outerDiameter','gasketDiameter','holeDiameter','height','coneHeight','wallCylinder','wallCone'],[source(col+str(row)) for row in range(4,13)]))
            d,dw,df,dm,hole,h,h2,s1,s2 = geometry.values()
            y = ((s1+s2)*h*h2+0.33*h2*h2*(s2+2*s1)+0.5*h*h*(df-d-2*hole))/((s1+s2)*h2+(df-d-2*hole)*h)
            e2 = abs(dw-dm)/2
            for mode,result_col,inputs,force_col in [('normal',col,'C','I'),('hydro',hydro_col,'D','J')]:
                rm,rp = source(inputs+str(rm_row)),source(inputs+str(rp_row))
                rm = rm if isinstance(rm,(int,float)) else None
                rp = rp if isinstance(rp,(int,float)) else None
                base = rm/2.2 if mode == 'normal' and cast_iron else min(v for v in [rm/2.6 if rm else None,rp/1.5 if rp else None] if v is not None)
                s0 = source(inputs+'4')*d/(2*base)
                wa = math.pi/4*((df-d-2*hole)*h*h+(d+s2)*(s2*s2-s0*s0/4))
                wb = 2*math.pi*((s2-s0)*(h+h2-y)**3/(3*h2)+s1*(h+h2-y)**2+0.125*(d+s1)*(s1*s1-s0*s0/4)) if y > h else math.pi*((df-d-2*hole)*y*y+0.25*(d+s1)*(s1*s1-s0*s0/4))
                wc = math.pi*(df-2*hole)*h*h/4 if h <= s2 else None
                force,hydrostatic = source(force_col+'33'),source(force_col+'30')
                direct_allow = base if mode == 'normal' and cast_iron else base*(1.3 if mode == 'normal' else 1.7)
                terms = {18:s0,19:base,23:wa,24:wb,27:force*e2/1000,31:4*hydrostatic/(math.pi*((d+2*s2)**2-d*d)),32:direct_allow,38:4*hydrostatic/(math.pi*((d+2*s1)**2-d*d)),39:direct_allow}
                terms[33] = terms[32]/terms[31]; terms[40] = terms[39]/terms[38]
                if mode == 'normal':
                    terms.update({13:(dw-d-s1)/2,14:e2,15:(dw-(dm+d)/2)/2,22:y})
                    if wc is not None: terms[25] = wc
                    bending_allow = base if cast_iron else min((2.5-rp/rm)*rp,2*rp)
                    for stress_row,modulus in [(34,wa),(41,wb),(45,wc)]:
                        if modulus is not None:
                            terms[stress_row] = force*e2/modulus
                            terms[stress_row+1] = bending_allow
                            terms[stress_row+2] = bending_allow/terms[stress_row]
                checks = []
                for row,recomputed in terms.items():
                    address = result_col+str(row); cached = source(address)
                    if not math.isclose(cached,recomputed,rel_tol=1e-11,abs_tol=1e-9):
                        raise ValueError(f'{sheet_name} {address}: flange cache {cached} != independent {recomputed}')
                    checks.append({'cell':address,'formula':records[address]['formula'],'value':cached})
                flange_checks += len(checks)
                upper_column = 'N' if mode == 'normal' else 'O'
                upper_row = 80 if side == 'sideA' else 76
                upper_checks = [{'cell':upper_column+str(upper_row+i),**records[upper_column+str(upper_row+i)]} for i in range(3)]
                flange_cases.append({'sheet':sheet_name,'side':side,'mode':mode,'input':{**geometry,'mode':mode,'castIron':cast_iron,'castIronC':side == 'sideB','ultimateMPa':rm,'yieldMPa':rp,'pressure':source(inputs+'4'),'hydrostatic':hydrostatic,'fastenerForce':force,'pressureLoad':source(force_col+'18')*hydrostatic,'thermalForce':source(force_col+'32')},'column':result_col,'checks':checks,'upperChecks':upper_checks})

    selected = {}
    for address, record in cells.items():
        col = address.rstrip('0123456789')
        row = int(address[len(col):])
        if (col in ('B', 'C', 'D') and 3 <= row <= 110) or (col in ('H', 'I', 'J') and (4 <= row <= 18 or 22 <= row <= 49)) or (col in ('M','N','O') and (2 <= row <= 46 or 64 <= row <= 84)) or (col == 'F' and 20 <= row <= 23) or (col in ('Q', 'R', 'V', 'W') and 3 <= row <= 12) or address in (*lower,'P88','P89'):
            if record['value'] is not None or record['formula']:
                selected[address] = record
    result = {
        'source': {'file': SOURCE.name, 'sha256': hashlib.sha256(before).hexdigest(), 'sheet': 'Вузол №1', 'valuesAreSavedCaches': True, 'fullWorkbookRecalculated': False},
        'status': 'reference_extraction_for_formula_agreement',
        'cells': selected,
        'geometryChecks': verification,
        'complianceChecks': compliance_checks,
        'thermalChecks': thermal_checks,
        'forceChecks': force_checks,
        'strengthChecks': strength_checks,
        'maximumChecks': maximum_checks,
        'flangeCases': flange_cases,
        'thermalReferenceNotes': [
            'I22 uses an explicit 20-20 temperature difference; J22/J23 are literal zero.',
            'Node 1 I23 excludes C100 (threaded body) and the nut; node 2 includes C100.',
            'I32/J32 denominator excludes I12/J12; behavior of added spacers needs agreement.',
            'This captures source behavior and does not approve a general thermal model.'
        ],
        'comparisonOnly': {
            'areaUsingCatalogWidthEqualsSealingBandWidthMm2': math.pi * (width * mean - count * hole ** 2 / 4),
            'note': 'Alternative derived from catalog width rule, not an approved replacement of C18/C22.'
        },
    }
    if SOURCE.read_bytes() != before:
        raise RuntimeError('Source workbook changed during extraction; repeat with a stable source.')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Captured {len(selected)} cells; {len(verification)} geometry, {len(compliance_checks)} compliance, {len(thermal_checks)} thermal, {len(force_checks)} force/minimum, {len(strength_checks)} strength, {len(maximum_checks)} maximum and {flange_checks} flange checks ({len(flange_cases)} cases) passed. Source XLSX unchanged.')


if __name__ == '__main__':
    main()

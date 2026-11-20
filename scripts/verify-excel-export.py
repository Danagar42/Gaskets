"""Read-only comparison after opening/recalculating/saving the QA export in Excel."""
import hashlib
import json
import math
from pathlib import Path
import sys
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parent.parent
folder = root / 'inspection_scratch/verification'
path = Path(sys.argv[1]) if len(sys.argv) > 1 else folder / 'export-recalculated.xlsx'
expected = json.loads((folder / 'export-expected.json').read_text(encoding='utf-8'))
workbook = openpyxl.load_workbook(path, data_only=True)
formulas = openpyxl.load_workbook(path, data_only=False)
comparisons, differences, bounds = [], [], []

def compare(sheet, address, value):
    actual = sheet[address].value
    if value is None:
        return
    ok = isinstance(actual, (int, float)) and math.isfinite(actual) and math.isclose(actual, value, rel_tol=1e-10, abs_tol=1e-10)
    item = {'sheet': sheet.title, 'cell': address, 'expected': value, 'actual': actual}
    comparisons.append(item)
    if not ok:
        differences.append(item)

for i, e in enumerate(expected['expected']):
    s = workbook.worksheets[i]
    for key, cell in [('width','C16'),('holeWidth','C17'),('effectiveWidth','C18'),('effectiveHoleWidth','C19'),('effectiveArea','C22'),('pressureArea','C23')]:
        compare(s, cell, e['geometry']['gasket']['values'][key])
    for key, cell in [('rootDiameter','C33'),('meanDiameter','C35'),('smoothArea','C47'),('threadArea','C48')]:
        compare(s, cell, e['geometry']['thread']['values'][key])
    for key, cell in [('smoothLength','C38'),('threadedLength','C39')]:
        compare(s, cell, e['geometry']['lengths']['values'][key])
    for mode, col, out in [('normal','I','N'),('hydro','J','O')]:
        for key, row in [('gasket',4),('washerA',8),('washerB',9),('sideB',10),('sideA',11),('extras',12),('threadJoint1',13),('threadJoint2',14),('smoothPart',15),('threadedPart',16),('fastener',17),('loadFactor',18)]:
            compare(s, col+str(row), e['compliance']['states'][mode]['values'][key])
        compare(s, col+'22',0)
        compare(s, col+'23',e['thermal'][mode]['values']['pack'])
        for key, row in [('initialSingle',27),('initialTotal',28),('sealing',29),('hydrostatic',30),('seating',31),('thermal',32),('fastener',33),('gasket',34),('sealingRequired',43),('contactPressure',44)]:
            compare(s, col+str(row),e['forces']['states'][mode]['values'][key])
        strength=e['strength']['states'][mode]
        for key, row in [('axial',4),('allowable',5),('thermalAxial',7),('thermalAllowable',8),('equivalent',10),('equivalentAllowable',11),('torsion',13),('torsionAllowable',14)]:
            compare(s, out+str(row),strength['values'][key])
        for key, row in [('fastenerNut',23),('fastenerBody',30),('nut',37),('body',44)]:
            check=strength['threads'][key]
            compare(s,out+str(row),check['actual']);compare(s,out+str(row+1),check['allowable']);compare(s,out+str(row+2),check['margin'])
        for side, fcol in [('sideB','R' if mode=='normal' else 'S'),('sideA','W' if mode=='normal' else 'X')]:
            flange=e['limits']['flanges']['sides'][side]
            if flange['mode']!='flange':continue
            flange=flange['states'][mode]
            for key,row in [('s0',18),('allowable',19),('y',22),('WA',23),('WB',24),('moment',27)]:
                # y is a single merged normal/hydro input in the template.
                cell_col = ('R' if side=='sideB' else 'W') if row==22 else fcol
                compare(s,cell_col+str(row),flange['values'][key])
            for key,row in [('pressureA',31),('bendingA',34),('pressureB',38),('bendingB',41),('bendingC',45)]:
                check=flange['checks'][key]
                compare(s,fcol+str(row),check['actual']);compare(s,fcol+str(row+1),check['allowable']);compare(s,fcol+str(row+2),check['margin'])
    for which, force_cell, torque_cell, rounded_cell in [('minimum','N57','N58','P88'),('maximum','N83','N84','P89')]:
        limit=e['limits'][which]
        compare(s,force_cell,limit['force']);compare(s,torque_cell,limit['torqueNm']);compare(s,rounded_cell,limit['roundedTorqueNm'])
    bounds.append({'node':s.title,'minimum':s['P88'].value,'maximum':s['P89'].value})
    for row in s:
        for cell in row:
            if cell.data_type=='e':differences.append({'sheet':s.title,'cell':cell.coordinate,'error':cell.value})
    assert formulas.worksheets[i]['P88'].data_type=='f'
    assert formulas.worksheets[i]['P89'].data_type=='f'
    assert len(formulas.worksheets[i]._images)==3, 'Lost original drawings'

result={'engine':'Microsoft Excel desktop','file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'comparisons':len(comparisons),'differences':differences,'bounds':bounds}
(folder/'export-comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
if differences:sys.exit(1)

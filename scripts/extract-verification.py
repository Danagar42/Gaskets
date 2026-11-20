"""Read source and a Microsoft Excel-recalculated QA copy; never edit either XLSX."""
import hashlib
import json
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Насос 600В-1,6_100.xlsx'
COPY = ROOT / 'inspection_scratch/verification/excel-recalculated-20261114.xlsx'
OUTPUT = ROOT / 'tests/fixtures/workbook-verification.json'


def snapshot(path):
    formula_book = openpyxl.load_workbook(path, data_only=False)
    values_book = openpyxl.load_workbook(path, data_only=True)
    result = {}
    for sheet in formula_book:
        if not sheet.title.startswith('Вузол №'):
            continue
        cells = {}
        for row in sheet.iter_rows(min_row=2,max_row=110,max_col=24):
            for cell in row:
                if cell.value is not None:
                    cells[cell.coordinate] = {'formula':cell.value if cell.data_type == 'f' else None,'value':values_book[sheet.title][cell.coordinate].value}
        result[sheet.title] = cells
    return result


def main():
    before = {path:hashlib.sha256(path.read_bytes()).hexdigest() for path in (SOURCE,COPY)}
    original, recalculated = snapshot(SOURCE), snapshot(COPY)
    inputs, formulas, caches, errors = [], [], [], []
    for name,cells in recalculated.items():
        for address in set(cells) | set(original[name]):
            old = original[name].get(address,{'value':None,'formula':None})
            new = cells.get(address,{'value':None,'formula':None})
            record = {'sheet':name,'cell':address,'before':old,'after':new}
            if old['formula'] != new['formula']:
                formulas.append(record)
            elif old['value'] != new['value']:
                (caches if new['formula'] else inputs).append(record)
            if isinstance(new['value'],str) and new['value'].startswith(('#REF!','#VALUE!','#DIV/0!','#N/A','#NUM!','#NAME?')):
                errors.append({'sheet':name,'cell':address,'value':new['value']})
    unexpected_inputs = [record for record in inputs if not (record['sheet'] == 'Вузол №4' and record['cell'] == 'C15' and record['after']['value'] == 1)]
    if formulas or unexpected_inputs:
        raise RuntimeError(f'Unexpected edits in QA copy: {len(formulas)} formulas, {unexpected_inputs}')
    if recalculated['Вузол №4']['C15']['value'] != 1:
        raise RuntimeError('User-confirmed correction C15=1 is missing')
    for path,digest in before.items():
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise RuntimeError(f'File changed during read: {path.name}')
    result = {'source':{'file':SOURCE.name,'sha256':before[SOURCE]},
              'recalculation':{'engine':'Microsoft Excel desktop','file':str(COPY.relative_to(ROOT)),'sha256':before[COPY],'correction':{'sheet':'Вузол №4','cell':'C15','value':1,'authority':'User confirmed 1 mm in this chat'}},
              'inputChanges':inputs,'formulaChanges':formulas,'cachedValueChanges':caches,'errors':errors,
              'originalSheets':original,'sheets':recalculated}
    OUTPUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Extracted {len(recalculated)} Excel-recalculated sheets; {len(inputs)} approved input edit; {len(formulas)} formula edits; {len(caches)} cache changes; {len(errors)} cell errors.')
    for name,cells in recalculated.items():
        print(name, {address:cells.get(address,{}).get('value') for address in ('C15','I18','J18','I32','N58','N84','P88','P89')})


if __name__ == '__main__':
    main()

import json
import sys
import re
import zipfile
from collections import Counter
import openpyxl
from openpyxl.formula.tokenizer import Tokenizer

sys.stdout.reconfigure(encoding='utf-8')
PATH = 'D:/Розробка/Прокладки/Насос 600В-1,6_100.xlsx'
wb = openpyxl.load_workbook(PATH, data_only=False)
cached = openpyxl.load_workbook(PATH, data_only=True)
mode = sys.argv[1] if len(sys.argv) > 1 else 'overview'

def out(x):
    print(json.dumps(x, ensure_ascii=False, default=str))

def cells_row(s, row, first=1, last=25):
    return {c.coordinate: {'f': c.value, 'v': cached[s.title][c.coordinate].value} if c.data_type == 'f' else c.value for c in s[row][first-1:last] if c.value is not None}

if mode == 'overview':
    out({'sheets': [(s.title, s.sheet_state, s.max_row, s.max_column) for s in wb], 'names': [(x.name, x.attr_text) for x in wb.defined_names.values()], 'calc': str(wb.calculation)})
    for s in wb:
        fs = [c for row in s for c in row if c.data_type == 'f']
        functions = Counter(fn.upper() for c in fs for fn in re.findall(r'([A-Za-z_.][A-Za-z_0-9.]*)\(', c.value))
        out({'sheet': s.title, 'formulas': len(fs), 'functions': functions, 'errors': [(c.coordinate,c.value) for row in cached[s.title] for c in row if c.data_type == 'e'], 'P88':cells_row(s,88,13,16), 'P89':cells_row(s,89,13,16), 'validations':[{'range':str(x.sqref),'type':x.type,'formula':x.formula1} for x in s.data_validations.dataValidation], 'images':len(s._images), 'charts':len(s._charts), 'print_area':str(s.print_area)})
elif mode == 'inputs':
    for i,s in enumerate(wb):
        out({'sheet':s.title})
        for r in range(1,113):
            row=cells_row(s,r,1,6)
            if row: out(row)
        if len(sys.argv)>2 and sys.argv[2]=='first': break
elif mode == 'formulas':
    s=wb.worksheets[int(sys.argv[2]) if len(sys.argv)>2 else 0]
    out({'sheet':s.title})
    first=int(sys.argv[3]) if len(sys.argv)>3 else 1
    last=int(sys.argv[4]) if len(sys.argv)>4 else 167
    for r in range(first,last+1):
        row=cells_row(s,r,7,25)
        if row: out(row)
elif mode == 'compare':
    s=wb.worksheets[0]
    for target in wb.worksheets[1:]:
        out({'compare': [s.title,target.title]})
        for row in s:
            for c in row:
                other=target[c.coordinate]
                if c.value!=other.value:
                    out({'cell':c.coordinate,'base':c.value,'other':other.value,'base_cache':cached[s.title][c.coordinate].value,'other_cache':cached[target.title][c.coordinate].value})
elif mode == 'notes':
    s=wb.worksheets[0]
    out({'sheet':s.title})
    for row in s:
        for c in row:
            if c.comment: out({'cell':c.coordinate,'note':c.comment.text})
elif mode == 'refs':
    s=wb.worksheets[0]
    result={}
    def refs(c):
        if c in result:return
        f=s[c].value
        result[c]={'formula':f,'cached':cached[s.title][c].value}
        if not isinstance(f,str) or not f.startswith('='):return
        for tok in Tokenizer(f).items:
            if tok.type=='OPERAND' and tok.subtype=='RANGE':
                ref=tok.value.replace('$','')
                if re.fullmatch(r'[A-Z]+[0-9]+',ref): refs(ref)
                elif re.fullmatch(r'[A-Z]+[0-9]+:[A-Z]+[0-9]+',ref):
                    for row in s[ref]:
                        for cc in row:refs(cc.coordinate)
                else:out({'unresolved':ref,'from':c})
    for c in sys.argv[2:]:refs(c)
    for c,v in result.items():out({'cell':c,**v})
elif mode == 'summary':
    for s in wb:
        sc=cached[s.title]
        out({'sheet':s.title,'components':{c:sc[c].value for c in ['B83','B92','C12','C13','C14','C15','C24','D24','C25','D25','C34','C38','C40','C89','C101']},'inputs':{c:s[c].value for c in ['P4','P5','C49','I22','J22','I23','J23']},'results':{c:sc[c].value for c in ['I4','J4','I18','J18','I32','J32','C6','P88','P89','N57','N58','N83','N84','I61','J63']}})
        low=['N52','N53','O53','N55','O55']
        high=['O74','N66','O66','N67','N71','N72','N73','N74','O72','O71','O73','N76','O76','O77','N77','O78','N78','O67','N68','O68','N69','O69','N80','O80','N81','O81','O82','N82']
        for name,coords,target in [('minimum',low,'N57'),('maximum',high,'N83')]:
            vals=[{'cell':c,'label':sc['M'+re.sub('[A-Z]+','',c)].value,'value':sc[c].value,'binding':sc[c].value==sc[target].value} for c in coords]
            out({'constraint':name,'candidates':vals})
elif mode == 'structure':
    z=zipfile.ZipFile(PATH)
    out({'macros':[n for n in z.namelist() if 'vba' in n.lower()],'external':[n for n in z.namelist() if 'external' in n.lower()],'connections':[n for n in z.namelist() if 'connections' in n.lower()]})
    for s in wb:
        fs=[c for row in s for c in row if c.data_type=='f']
        out({'sheet':s.title,'crossrefs':[(c.coordinate,c.value) for c in fs if '!' in c.value],'hidden_cols':[(k,d.min,d.max) for k,d in s.column_dimensions.items() if d.hidden],'hidden_rows':[i for i,d in s.row_dimensions.items() if d.hidden],'protected':s.protection.sheet,'auto_filter':s.auto_filter.ref,'tables':list(s.tables.keys()),'notes':sum(c.comment is not None for row in s for c in row),'calc_formulas':len(fs)})
elif mode == 'diffs':
    s=wb.worksheets[0]
    for target in wb.worksheets[1:]:
        out({'compare':[s.title,target.title]})
        diffs=[]
        for row in s:
            for c in row:
                other=target[c.coordinate]
                if c.value!=other.value and (c.data_type=='f' or other.data_type=='f'):
                    diffs.append({'cell':c.coordinate,'base':c.value,'other':other.value})
        out(diffs)
elif mode == 'checks':
    for s in wb:
        sc=cached[s.title]
        out({'sheet':s.title,'temperatures':{c:sc[c].value for c in ['C5','D5']},'suspect_thermal':{c:s[c].value for c in ['C49','D49','I22','J22','I23','J23','D75','D88','D100']},'tables':[(t.name,t.ref) for t in s.tables.values()],'print_area':str(s.print_area),'images':[{'type':im.format,'width':im.width,'height':im.height,'at':str(im.anchor._from)} for im in s._images],'minimum_formula':s['N57'].value,'maximum_formula':s['N83'].value})
elif mode == 'functions':
    all_functions=Counter()
    formulas=[]
    for s in wb:
        fs=[c for row in s for c in row if c.data_type=='f']
        formulas.extend(c.value for c in fs)
        all_functions.update(fn.upper() for c in fs for fn in re.findall(r'([A-Za-z_.][A-Za-z_0-9.]*)\(',c.value))
    out({'formula_count':len(formulas),'unique_formula_texts':len(set(formulas)),'functions':all_functions})
elif mode == 'dep_summary':
    for s in wb:
        def precedents(coord):
            f=s[coord].value
            result=[]
            if not isinstance(f,str) or not f.startswith('='):return result
            for tok in Tokenizer(f).items:
                if tok.type=='OPERAND' and tok.subtype=='RANGE':
                    ref=tok.value.replace('$','')
                    if re.fullmatch(r'[A-Z]+[0-9]+',ref):result.append(ref)
                    elif re.fullmatch(r'[A-Z]+[0-9]+:[A-Z]+[0-9]+',ref):
                        result.extend(cc.coordinate for row in s[ref] for cc in row)
            return result
        for goal in ['P88','P89']:
            seen=set()
            leaves={}
            todo=[goal]
            while todo:
                c=todo.pop()
                if c in seen:continue
                seen.add(c)
                ps=precedents(c)
                if ps:todo.extend(ps)
                else:leaves[c]=s[c].value
            out({'sheet':s.title,'goal':goal,'dependency_count':len(seen)-1,'C6_dependency':'C6' in seen,'qmax_dependency':'C26' in seen,'leaves':dict(sorted(leaves.items()))})

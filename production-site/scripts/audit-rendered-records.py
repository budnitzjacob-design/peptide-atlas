from html.parser import HTMLParser
from pathlib import Path
import json
class Record(HTMLParser):
 def __init__(self):
  super().__init__();self.structure=[];self.words=[];self.tags=[];self.skip=0
 def handle_starttag(self,t,a):
  self.structure.append(('start',t,sorted(a)))
  hidden=any(k=='class' and 'citation-popover' in v.split() for k,v in a)
  self.tags.append((t,hidden));self.skip+=int(hidden)
  if t in ('br','img','input','meta','link','hr','source','wbr'):self.tags.pop();self.skip-=int(hidden)
 def handle_endtag(self,t):
  self.structure.append(('end',t))
  if self.tags:
   _,h=self.tags.pop();self.skip-=int(h)
 def handle_data(self,text):
  if not self.skip:self.words.extend(text.split())
root=Path('generated/research-2026-10-19')
before={r['id']:r for r in json.loads((root/'rendered-before.json').read_text())};after=json.loads((root/'rendered-after.json').read_text());rows=[]
for r in after:
 a,b=Record(),Record();a.feed(before[r['id']]['html']);b.feed(r['html']);assert a.structure==b.structure,r['id']+' changed markup/attributes';rows.append({'id':r['id'],'beforeWords':len(a.words),'afterWords':len(b.words)})
old=sum(r['beforeWords'] for r in rows);new=sum(r['afterWords'] for r in rows)
report={'scope':'All rendered expanded-record text, all sections open; includes unchanged labels, study tables and reference titles; excludes citation hover-popover duplicates.','records':len(rows),'beforeWords':old,'afterWords':new,'reductionPercent':100*(1-new/old),'markupAndAttributes':'Identical for every expanded record','perRecord':rows}
(root/'expanded-rendered-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='perRecord'},indent=2))

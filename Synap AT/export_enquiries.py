"""Run on the host: python export_enquiries.py > enquiries.csv"""
import csv, json, sys
from server import database
fields=['created_at','name','email','company','services','url','timeline','message']
writer=csv.DictWriter(sys.stdout,fieldnames=fields);writer.writeheader()
with database() as db:
    for created,payload in db.execute('SELECT created_at,payload FROM enquiries ORDER BY created_at DESC'):
        item=json.loads(payload); item['created_at']=created;item['services']=', '.join(item['services'])
        # Neutralize spreadsheet formulas when exports are opened in Excel.
        writer.writerow({k: ("'"+str(item[k]) if str(item[k]).lstrip().startswith(('=','+','-','@')) else item[k]) for k in fields})

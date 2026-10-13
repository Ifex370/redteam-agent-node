"""SynapDome marketing site and private enquiry intake."""
import json, os, re, sqlite3, time, uuid, mimetypes
from pathlib import Path
from urllib.parse import urlparse
from wsgiref.simple_server import make_server
ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
DATA = Path(os.environ.get('DATA_DIR', str(ROOT / 'data')))
SERVICES = {'Web applications', 'Mobile applications', 'APIs and integrations', 'Cloud environments', 'Code and delivery pipelines', 'Network and exposure'}

def database():
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(DATA / 'enquiries.sqlite3', timeout=10)
    db.execute('CREATE TABLE IF NOT EXISTS enquiries (id TEXT PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP, payload TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS rate_limits (address TEXT PRIMARY KEY, started REAL, count INTEGER)')
    return db

def validate(data):
    if not isinstance(data, dict): raise ValueError('Please provide valid form details.')
    for key, limit in [('name',120),('email',254),('company',160),('message',3000),('timeline',60)]:
        value = data.get(key)
        if not isinstance(value,str) or not value.strip() or len(value)>limit: raise ValueError('Please complete all required fields within the allowed length.')
        data[key] = value.strip()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', data['email']): raise ValueError('Please enter a valid email address.')
    if data['timeline'] not in ['As soon as possible','Within two weeks','This month','Planning ahead']: raise ValueError('Please choose a valid timeline.')
    services=data.get('services')
    if not isinstance(services,list) or not services or len(services)>6 or any(not isinstance(s,str) or s not in SERVICES for s in services): raise ValueError('Please select a valid review area.')
    if data.get('consent') is not True: raise ValueError('Please agree to being contacted about your enquiry.')
    url=data.get('url','')
    if not isinstance(url,str) or len(url)>500: raise ValueError('Please enter a valid application URL.')
    if url and (urlparse(url).scheme not in ['http','https'] or not urlparse(url).netloc): raise ValueError('Please enter a complete application URL.')
    return {key:data.get(key,'') for key in ['name','email','company','services','url','timeline','message','consent']}

def app(env,start):
    def respond(code,body,kind='application/json'):
        if isinstance(body,dict): body=json.dumps(body).encode()
        headers=[('Content-Type',kind),('Content-Length',str(len(body))),('X-Content-Type-Options','nosniff'),('Referrer-Policy','strict-origin-when-cross-origin'),('X-Frame-Options','DENY'),('Cache-Control','no-store'),('Content-Security-Policy',"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")]
        start(code,headers); return [body]
    path=env.get('PATH_INFO','/')
    if path == '/api/enquiries':
        if env['REQUEST_METHOD']!='POST': return respond('405 Method Not Allowed',{'error':'Please submit the enquiry form.'})
        origin=env.get('HTTP_ORIGIN')
        expected=os.environ.get('PUBLIC_ORIGIN')
        if origin and (origin != expected if expected else urlparse(origin).netloc != env.get('HTTP_HOST')): return respond('403 Forbidden',{'error':'Please submit from this website.'})
        if env.get('CONTENT_TYPE','').split(';')[0]!='application/json': return respond('415 Unsupported Media Type',{'error':'Invalid request format.'})
        try:
            length=int(env.get('CONTENT_LENGTH') or 0)
            if length<1 or length>20000: return respond('413 Payload Too Large',{'error':'Your request is too large.'})
            data=json.loads(env['wsgi.input'].read(length))
            if isinstance(data,dict) and data.get('website'): return respond('200 OK',{'ok':True})
            clean=validate(data)
        except (ValueError,TypeError): return respond('400 Bad Request',{'error':'Please check your details, select a review area and agree to being contacted.'})
        try:
            with database() as db:
                # Never trust a client supplied forwarding header for rate limiting.
                address=env.get('REMOTE_ADDR','unknown'); now=time.time()
                db.execute('BEGIN IMMEDIATE')
                db.execute('DELETE FROM rate_limits WHERE started < ?', (now-3600,))
                row=db.execute('SELECT count FROM rate_limits WHERE address=?',(address,)).fetchone()
                if row and row[0]>=20: return respond('429 Too Many Requests',{'error':'Too many requests. Please try again later.'})
                db.execute('INSERT INTO rate_limits VALUES (?,?,1) ON CONFLICT(address) DO UPDATE SET count=count+1',(address,now))
                db.execute('INSERT INTO enquiries(id,payload) VALUES (?,?)',(str(uuid.uuid4()),json.dumps(clean)))
            return respond('201 Created',{'ok':True})
        except sqlite3.Error: return respond('503 Service Unavailable',{'error':'Unable to save your request. Please try again shortly.'})
    if env['REQUEST_METHOD'] not in ['GET','HEAD']: return respond('405 Method Not Allowed',{'error':'Method not allowed.'})
    file=(PUBLIC/('index.html' if path=='/' else path.lstrip('/'))).resolve()
    if not file.is_relative_to(PUBLIC) or not file.is_file(): return respond('404 Not Found',b'Page not found.','text/plain')
    body=file.read_bytes()
    if env['REQUEST_METHOD']=='HEAD': body=b''
    return respond('200 OK',body,mimetypes.guess_type(str(file))[0] or 'application/octet-stream')

if __name__=='__main__':
    port=int(os.environ.get('PORT','4174'))
    print(f'SynapDome: http://127.0.0.1:{port}',flush=True)
    make_server('127.0.0.1',port,app).serve_forever()

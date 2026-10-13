import io,json,tempfile,unittest
from pathlib import Path
import server
class IntakeTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();server.DATA=Path(self.temp.name)
        self.data=dict(name='Test Prospect',email='test@example.com',company='Example',services=['Web applications'],url='https://example.com',timeline='Planning ahead',message='Staging review',consent=True)
    def tearDown(self): self.temp.cleanup()
    def request(self,data=None,path='/api/enquiries',origin='http://localhost:4174',method='POST'):
        body=json.dumps(data).encode();status=[]
        env={'PATH_INFO':path,'REQUEST_METHOD':method,'HTTP_HOST':'localhost:4174','HTTP_ORIGIN':origin,'CONTENT_TYPE':'application/json','CONTENT_LENGTH':str(len(body)),'wsgi.input':io.BytesIO(body),'REMOTE_ADDR':'127.0.0.1'}
        result=b''.join(server.app(env,lambda s,h:status.append(s)))
        return status[0],result
    def test_persists_valid_request(self):
        self.assertEqual(self.request(self.data)[0],'201 Created')
        with server.database() as db:self.assertEqual(db.execute('SELECT count(*) FROM enquiries').fetchone()[0],1)
    def test_invalid_fields(self):
        for change in [dict(email='bad'),dict(consent=False),dict(services=['unknown']),dict(name=''),dict(message='x'*3001)]:
            self.assertEqual(self.request({**self.data,**change})[0],'400 Bad Request')
    def test_cross_origin(self):self.assertEqual(self.request(self.data,origin='https://other.example')[0],'403 Forbidden')
    def test_private_storage(self):self.assertEqual(self.request(path='/../data/enquiries.sqlite3',method='GET')[0],'404 Not Found')
    def test_rate_limit(self):
        for _ in range(20):self.assertEqual(self.request(self.data)[0],'201 Created')
        self.assertEqual(self.request(self.data)[0],'429 Too Many Requests')
    def test_honeypot(self):
        self.assertEqual(self.request({**self.data,'website':'spam'})[0],'200 OK')
        with server.database() as db:self.assertEqual(db.execute('SELECT count(*) FROM enquiries').fetchone()[0],0)
if __name__=='__main__':unittest.main()

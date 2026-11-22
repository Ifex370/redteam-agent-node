import importlib.util, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('gateway',Path(__file__).resolve().parents[1]/'scripts/render-gateway.py')
gateway=importlib.util.module_from_spec(spec);spec.loader.exec_module(gateway)
class Gateway(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        cert=Path(self.tmp.name)/'cert';cert.touch()
        self.env=dict(WORKSPACE_HOST='redteam.synapdome.com',TLS_CERT=str(cert),TLS_KEY=str(cert),AUTH_VERIFY_URL='http://127.0.0.1:9000/internal/auth/redteam',CYBERSTRIKE_SERVER_PASSWORD='x'*40)
    def test_missing_auth_fails_closed(self):
        del self.env['AUTH_VERIFY_URL']
        with self.assertRaises(ValueError): gateway.render(self.env)
    def test_external_validation_endpoint_rejected(self):
        self.env['AUTH_VERIFY_URL']='http://evil.example/verify'
        with self.assertRaises(ValueError): gateway.render(self.env)
    def test_configuration_injection_rejected(self):
        self.env['WORKSPACE_HOST']='test.com; auth_request off;'
        with self.assertRaises(ValueError): gateway.render(self.env)
    def test_routes_protected_and_secret_not_literal(self):
        result=gateway.render(self.env)
        self.assertIn('auth_request /_synap_auth;',result)
        self.assertIn('internal;',result)
        self.assertNotIn('${',result)
        self.assertNotIn(self.env['CYBERSTRIKE_SERVER_PASSWORD'],result)
        self.assertIn('proxy_set_header Cookie "";',result)
    def test_missing_certificate_rejected(self):
        self.env['TLS_CERT']='/nonexistent/cert'
        with self.assertRaises(ValueError): gateway.render(self.env)
if __name__=='__main__': unittest.main()

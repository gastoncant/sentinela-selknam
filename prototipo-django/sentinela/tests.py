from django.test import TestCase, Client
from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.core.cache import cache
from .models import Run, Candidate, Review


class PilotFlow(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("import_pilot","A",verbosity=0)
        cls.analysis = Run.objects.get()
        cls.c = cls.analysis.candidates.first()
        cls.user = User.objects.create_user("op")
        cls.user.groups.add(cls.analysis.org)

    def setUp(self):
        self.url = f"/analisis/{self.analysis.pk}/"
        self.write = f"/revisar/{self.c.pk}/"
        self.form = dict(state="Otra causa", reason="<b>Estacional</b>",version="0")

    def test_private_discovery_and_assets(self):
        self.assertNotContains(self.client.get("/"),"19FFV")
        for url in [self.url,self.url+"before.png",self.url+"candidates.geojson"]:
            self.assertEqual(self.client.get(url).status_code,404)
        self.assertEqual(self.client.post(self.write,self.form).status_code,302)
        self.assertEqual(Review.objects.count(),0)

    def test_cross_org(self):
        other = User.objects.create_user("otra")
        other.groups.add(Group.objects.create(name="B"))
        self.client.force_login(other)
        self.assertEqual(self.client.get(self.url).status_code,404)
        self.assertEqual(self.client.post(self.write,{**self.form,"org":self.analysis.org_id}).status_code,404)

    def test_review_conflict_and_public_redaction(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.post(self.write,self.form).status_code,302)
        self.assertEqual(self.client.post(self.write,self.form).status_code,409)
        self.assertEqual(Review.objects.count(),1)
        self.assertContains(self.client.get(self.url),"&lt;b&gt;Estacional&lt;/b&gt;")
        call_command("import_pilot","A",publish=True)
        self.client.logout()
        self.assertNotContains(self.client.get(self.url),"Estacional")
        self.assertContains(self.client.get(self.url+"?ficha="+self.c.key),"Recuadro")
        self.assertEqual(self.client.get(self.url+"before.png")["Content-Type"],"image/png")
        data=self.client.get(self.url+"candidates.geojson").json()
        self.assertEqual(len(data["features"]),self.analysis.manifest["count"])

    def test_repeat_import(self):
        call_command("import_pilot","A")
        self.assertEqual(Run.objects.count(),1)
        self.assertEqual(Candidate.objects.count(),self.analysis.manifest["count"])

    def test_invalid_and_csrf(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.post(self.write,{**self.form,"state":"Confirmado"}).status_code,400)
        strict=Client(enforce_csrf_checks=True)
        strict.force_login(self.user)
        self.assertEqual(strict.post(self.write,self.form).status_code,403)
        self.assertFalse(Review.objects.exists())

    def test_login_limit(self):
        cache.clear()
        for _ in range(10):
            self.assertEqual(self.client.post("/ingresar/",{}).status_code,200)
        self.assertEqual(self.client.post("/ingresar/",{}).status_code,429)
        cache.clear()


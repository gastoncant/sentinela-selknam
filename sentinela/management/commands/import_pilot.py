import hashlib
import json
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import Group
from django.db import transaction
from sentinela.models import Run, Candidate, Product


class Command(BaseCommand):
    help = "Importa el producto incluido. La publicación requiere --publish."

    def add_arguments(self, parser):
        parser.add_argument("organization")
        parser.add_argument("--publish", action="store_true")

    @transaction.atomic
    def handle(self, organization, publish, **options):
        root = settings.ROOT/"pilot"
        raw = (root/"manifest.json").read_bytes()
        manifest = json.loads(raw)
        products = {}
        for name in ("before.png","after.png","signals.png","candidates.geojson"):
            products[name] = (root/name).read_bytes()
            if hashlib.sha256(products[name]).hexdigest() != manifest["hashes"][name]:
                raise CommandError("Producto inconsistente: "+name)
        org,_ = Group.objects.get_or_create(name=organization)
        run,new = Run.objects.get_or_create(org=org,fingerprint=hashlib.sha256(raw).hexdigest(),defaults={"manifest":manifest})
        if new:
            for name, data in products.items():
                Product.objects.create(run=run,name=name,content=data)
            for f in json.loads(products["candidates.geojson"])["features"]:
                Candidate.objects.create(run=run,key=f["properties"]["id"],feature=f)
        if publish:
            run.published = True
            run.save(update_fields=["published"])
        self.stdout.write(f"Análisis {run.pk}; publicado={run.published}")


import sqlite3
from pathlib import Path
from contextlib import closing
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Copia SQLite en caliente. El destino debe ser nuevo."

    def add_arguments(self, parser):
        parser.add_argument("destination", type=Path)

    def handle(self, destination, **options):
        with destination.open("xb"):
            pass
        source_uri = Path(settings.DATABASES["default"]["NAME"]).resolve().as_uri()+"?mode=ro"
        with closing(sqlite3.connect(source_uri,uri=True)) as src, closing(sqlite3.connect(destination)) as dst:
            src.backup(dst)
            if dst.execute("PRAGMA integrity_check").fetchone() != ("ok",) or dst.execute("PRAGMA foreign_key_check").fetchone():
                raise CommandError("Falló la verificación de integridad.")


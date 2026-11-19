"""Run against a new temporary DB and an independently opened restored copy."""
import os
import sys
import subprocess
import tempfile
import shutil
import sqlite3
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

import django

def main(folder):
    db=folder/"active.sqlite3"
    os.environ.update(LOCAL_DEMO="1",APP_DB=str(db),DJANGO_SETTINGS_MODULE="sentinela.settings")
    django.setup()
    from django.contrib.auth.models import User
    from django.core.management import call_command
    from django.db import connections
    from django.test import Client
    from sentinela.models import Run, Review, Product
    call_command("migrate",verbosity=0)
    call_command("import_pilot","Ensayo")
    run=Run.objects.get()
    op=User.objects.create_user("prueba")
    op.groups.add(run.org)
    candidate=run.candidates.first()
    gate=Barrier(4)
    def submit(i):
        try:
            client=Client(HTTP_HOST="localhost")
            client.force_login(op)
            gate.wait(timeout=15)
            return client.post(f"/revisar/{candidate.pk}/",dict(version="0",state="Otra causa",reason=f"Ensayo {i}")).status_code
        finally:
            connections.close_all()
    with ThreadPoolExecutor(max_workers=4) as pool:
        statuses=sorted(pool.map(submit,range(4)))
    assert statuses==[302,409,409,409],statuses
    assert Review.objects.count()==1
    backup=folder/"backup.sqlite3"
    call_command("backup",backup)
    restored=folder/"restore.sqlite3"
    shutil.copyfile(backup,restored)
    from django.conf import settings
    connections.close_all()
    connections.databases["default"]["NAME"]=str(restored)
    with closing(sqlite3.connect(restored)) as restored_db:
        assert restored_db.execute("PRAGMA integrity_check").fetchone()==("ok",)
    restored_run=Run.objects.get()
    assert restored_run.candidates.count()==run.manifest["count"]
    assert Review.objects.get().author.username=="prueba"
    client=Client(HTTP_HOST="localhost")
    assert client.get(f"/analisis/{run.pk}/before.png").status_code==404
    client.force_login(User.objects.get())
    assert client.get(f"/analisis/{run.pk}/").status_code==200
    for p in Product.objects.all():
        assert client.get(f"/analisis/{run.pk}/{p.name}").status_code==200
    connections.close_all()
    print("4 escrituras simultáneas:",statuses,"| restauración verificada:",restored_run.candidates.count(),"geometrías, historial, permisos y cuatro productos")


if __name__=="__main__":
    if len(sys.argv) == 2:
        main(Path(sys.argv[1]))
    else:
        with tempfile.TemporaryDirectory() as folder:
            subprocess.run([sys.executable,__file__,folder],check=True)


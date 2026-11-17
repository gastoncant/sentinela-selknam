from django.core.management.base import BaseCommand, CommandError
from sentinela.models import Run


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("run_id",type=int)

    def handle(self, run_id, **options):
        if not Run.objects.filter(pk=run_id).update(published=False):
            raise CommandError("Análisis inexistente")
        self.stdout.write("Acceso público retirado.")


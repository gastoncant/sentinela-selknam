from getpass import getpass
from django.contrib.auth.models import Group, User
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = "Crea un operador para una organización existente"

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("organization")

    @transaction.atomic
    def handle(self, username, organization, **options):
        group = Group.objects.filter(name=organization).first()
        if not group or User.objects.filter(username=username).exists():
            raise CommandError("Verificá organización y nombre de usuario nuevo.")
        user = User(username=username)
        password = getpass("Contraseña: ")
        validate_password(password, user)
        if password != getpass("Repetir contraseña: "):
            raise CommandError("Las contraseñas difieren.")
        user.set_password(password)
        user.save()
        user.groups.add(group)


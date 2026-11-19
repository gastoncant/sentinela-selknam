import hashlib
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse


class PilotBoundary:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/ingresar/" and request.method == "POST":
            # Gunicorn only accepts traffic from Caddy in the production Compose network.
            address = request.META.get("REMOTE_ADDR","")
            if not settings.LOCAL:
                address = request.META.get("HTTP_X_FORWARDED_FOR",address).split(",")[-1].strip()
            key = "login-" + hashlib.sha256(address.encode()).hexdigest()
            if not cache.add(key,1,timeout=300):
                try:
                    attempts = cache.incr(key)
                except ValueError:  # Window expired between add and incr.
                    cache.add(key,1,timeout=300)
                    attempts = 1
                if attempts > 10:
                    return HttpResponse("Demasiados intentos. Reintentá en cinco minutos.",status=429)
        response = self.get_response(request)
        response["Cache-Control"] = "private, no-store"
        response["Content-Security-Policy"] = "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'"
        return response


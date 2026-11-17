import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCAL = os.getenv("LOCAL_DEMO") == "1"
SECRET_KEY = os.getenv("APP_SECRET") or ("solo-para-desarrollo-local" if LOCAL else os.environ["APP_SECRET"])
ALLOWED_HOSTS = ["localhost","127.0.0.1"] if LOCAL else [os.environ["APP_HOST"]]
DEBUG = False
ROOT_URLCONF = "sentinela.urls"
INSTALLED_APPS = ["django.contrib.auth","django.contrib.contenttypes","django.contrib.sessions","sentinela"]
MIDDLEWARE = ["django.middleware.security.SecurityMiddleware","django.contrib.sessions.middleware.SessionMiddleware",
              "django.middleware.common.CommonMiddleware","django.middleware.csrf.CsrfViewMiddleware",
              "django.contrib.auth.middleware.AuthenticationMiddleware","django.middleware.clickjacking.XFrameOptionsMiddleware"]
MIDDLEWARE.insert(1,"sentinela.middleware.PilotBoundary")
DATABASES = {"default":{"ENGINE":"django.db.backends.sqlite3","NAME":os.getenv("APP_DB",ROOT/"data.sqlite3"),
                        "OPTIONS":{"timeout":10,"transaction_mode":"IMMEDIATE"}}}
TEMPLATES = [{"BACKEND":"django.template.backends.django.DjangoTemplates","APP_DIRS":True,
              "OPTIONS":{"context_processors":["django.template.context_processors.request","django.contrib.auth.context_processors.auth"]}}]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO","https")
SECURE_SSL_REDIRECT = SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = not LOCAL
SESSION_COOKIE_AGE = 28800
SECURE_HSTS_SECONDS = 0 if LOCAL else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_PRELOAD = False
SECURE_REFERRER_POLICY = "same-origin"
LOGIN_URL = "/ingresar/"
LOGIN_REDIRECT_URL = LOGOUT_REDIRECT_URL = "/"
LANGUAGE_CODE = "es-ar"
TIME_ZONE = "UTC"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_MEMORY_SIZE = 32768
AUTH_PASSWORD_VALIDATORS = [{"NAME":"django.contrib.auth.password_validation."+name} for name in
                            ("MinimumLengthValidator","CommonPasswordValidator","UserAttributeSimilarityValidator","NumericPasswordValidator")]


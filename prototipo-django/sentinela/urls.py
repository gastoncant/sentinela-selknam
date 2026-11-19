from django.contrib.auth.views import LoginView, LogoutView
from django.urls import path
from . import views

urlpatterns = [
    path("",views.home,name="home"),
    path("ingresar/",LoginView.as_view(template_name="login.html")),
    path("salir/",LogoutView.as_view()),
    path("analisis/<int:pk>/",views.detail,name="detail"),
    path("analisis/<int:pk>/<str:name>",views.asset,name="asset"),
    path("revisar/<int:pk>/",views.review,name="review"),
]


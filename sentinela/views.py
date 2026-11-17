import hashlib
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_GET, require_POST
from .models import Run, Candidate, Review, Product

STATES = ("Compatible", "Otra causa", "Información insuficiente")


def visible(user):
    q = Q(published=True)
    if user.is_authenticated:
        q |= Q(org__in=user.groups.all())
    return Run.objects.filter(q).distinct()


@require_GET
def home(request):
    return render(request,"home.html",{"runs":visible(request.user).order_by("-id")[:50]})


@require_GET
def detail(request, pk):
    run = get_object_or_404(visible(request.user),pk=pk)
    member = request.user.is_authenticated and request.user.groups.filter(pk=run.org_id).exists()
    qs = run.candidates.order_by("id")
    kind = request.GET.get("signal","")
    if kind in ("agua","vegetacion"):
        qs = qs.filter(feature__properties__signal=kind)
    if member and request.GET.get("pending") == "1":
        qs = qs.filter(version=0)
    if member:
        qs = qs.prefetch_related("reviews__author")
    page = Paginator(qs,25).get_page(request.GET.get("page"))
    selected = None
    if request.GET.get("ficha"):
        selected = get_object_or_404(run.candidates,key=request.GET["ficha"])
    return render(request,"detail.html",dict(run=run,m=run.manifest,member=member,page=page,states=STATES,selected=selected,
                                               signal=kind,pending=request.GET.get("pending")=="1"))


@require_GET
def asset(request, pk, name):
    run = get_object_or_404(visible(request.user),pk=pk)
    if name not in ("before.png","after.png","signals.png","candidates.geojson"):
        raise Http404
    data = bytes(get_object_or_404(Product,run=run,name=name).content)
    if hashlib.sha256(data).hexdigest() != run.manifest["hashes"][name]:
        return HttpResponse("Producto no disponible para esta versión.",status=503)
    return HttpResponse(data,content_type="image/png" if name.endswith(".png") else "application/geo+json")


@require_POST
@login_required
@transaction.atomic
def review(request, pk):
    c = get_object_or_404(Candidate,pk=pk,run__org__in=request.user.groups.all())
    state = request.POST.get("state")
    reason = request.POST.get("reason","").strip()
    evidence = request.POST.get("evidence","").strip()
    version = request.POST.get("version","")
    if state not in STATES or not 1<=len(reason)<=1000 or len(evidence)>300 or not version.isascii() or not version.isdigit() or len(version)>9:
        return HttpResponse("Revisá los campos de la ficha.",status=400)
    if not Candidate.objects.filter(pk=pk,version=int(version)).update(state=state,version=int(version)+1):
        return HttpResponse("Otra revisión cambió esta ficha. Volvé a abrir el análisis.",status=409)
    Review.objects.create(candidate=c,author=request.user,state=state,reason=reason,evidence=evidence)
    return redirect("detail",pk=c.run_id)


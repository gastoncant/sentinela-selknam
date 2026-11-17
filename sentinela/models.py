from django.db import models
from django.contrib.auth.models import Group, User


class Run(models.Model):
    org = models.ForeignKey(Group,on_delete=models.PROTECT)
    fingerprint = models.CharField(max_length=64)
    manifest = models.JSONField()
    published = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["org","fingerprint"],name="one_run_per_org")]


class Product(models.Model):
    run = models.ForeignKey(Run, on_delete=models.PROTECT)
    name = models.CharField(max_length=32)
    content = models.BinaryField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["run","name"],name="one_product_per_run")]


class Candidate(models.Model):
    run = models.ForeignKey(Run,on_delete=models.PROTECT,related_name="candidates")
    key = models.CharField(max_length=80)
    feature = models.JSONField()
    version = models.PositiveIntegerField(default=0)
    state = models.CharField(max_length=32,default="Pendiente")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["run","key"],name="one_candidate_per_run")]


class Review(models.Model):
    candidate = models.ForeignKey(Candidate,on_delete=models.PROTECT,related_name="reviews")
    author = models.ForeignKey(User,on_delete=models.PROTECT)
    at = models.DateTimeField(auto_now_add=True)
    state = models.CharField(max_length=32)
    reason = models.CharField(max_length=1000)
    evidence = models.CharField(max_length=300,blank=True)


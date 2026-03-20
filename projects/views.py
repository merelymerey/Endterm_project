from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Project

@login_required
def dashboard(request):
    projects = Project.objects.filter(user=request.user)
    return render(request, 'projects/dashboard.html', {'projects': projects})

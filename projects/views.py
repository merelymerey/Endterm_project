import calendar as py_calendar
import json
from collections import defaultdict
from datetime import date, timedelta
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.db.models import Count, Q
from .models import Project, Task
from .forms import ProjectForm, TaskForm


@login_required
def dashboard(request):
    projects = Project.objects.filter(owner=request.user)
    total_tasks = Task.objects.filter(project__owner=request.user).count()
    completed_tasks = Task.objects.filter(project__owner=request.user, status='done').count()
    overdue_qs = Task.objects.filter(
        project__owner=request.user,
        due_date__lt=date.today(),
    ).exclude(status='done').select_related('project').order_by('due_date')
    overdue_tasks = overdue_qs.count()
    overdue_list = overdue_qs[:10]
    in_progress = Task.objects.filter(project__owner=request.user, status='in_progress').count()

    return render(request, 'projects/dashboard.html', {
        'projects': projects,
        'total_tasks': total_tasks,
        'completed_tasks': completed_tasks,
        'overdue_tasks': overdue_tasks,
        'overdue_list': overdue_list,
        'in_progress': in_progress,
    })


PROJECT_COLORS = ['#c96442', '#e09b3d', '#5cb87a', '#4a8fd9', '#9b6cd4', '#d4616e', '#3dbab0']


@login_required
def calendar_view(request):
    try:
        year = int(request.GET.get('year', date.today().year))
        month = int(request.GET.get('month', date.today().month))
    except (TypeError, ValueError):
        today = date.today()
        year, month = today.year, today.month

    if month < 1 or month > 12:
        today = date.today()
        year, month = today.year, today.month

    selected_day = request.GET.get('day')
    try:
        selected_date = date(year, month, int(selected_day)) if selected_day else None
    except (TypeError, ValueError):
        selected_date = None

    first_day = date(year, month, 1)
    last_day = date(year, month, py_calendar.monthrange(year, month)[1])

    tasks_in_month = Task.objects.filter(
        project__owner=request.user,
        due_date__gte=first_day,
        due_date__lte=last_day,
    ).select_related('project')

    by_day = defaultdict(list)
    for t in tasks_in_month:
        by_day[t.due_date.day].append(t)

    cal = py_calendar.Calendar(firstweekday=6)
    weeks = []
    for week in cal.monthdatescalendar(year, month):
        row = []
        for d in week:
            in_month = d.month == month
            day_tasks = by_day.get(d.day, []) if in_month else []
            dots = []
            seen_projects = set()
            for t in day_tasks:
                if t.project_id in seen_projects:
                    continue
                seen_projects.add(t.project_id)
                dots.append(PROJECT_COLORS[t.project_id % len(PROJECT_COLORS)])
                if len(dots) >= 5:
                    break
            row.append({
                'date': d,
                'in_month': in_month,
                'is_today': d == date.today(),
                'is_selected': selected_date is not None and d == selected_date,
                'task_count': len(day_tasks),
                'dots': dots,
            })
        weeks.append(row)

    selected_tasks = []
    if selected_date:
        selected_tasks = Task.objects.filter(
            project__owner=request.user,
            due_date=selected_date,
        ).select_related('project').order_by('priority', 'position')

    month_total = tasks_in_month.count()
    month_done = tasks_in_month.filter(status='done').count()
    month_overdue = tasks_in_month.filter(due_date__lt=date.today()).exclude(status='done').count()

    prev_month = (first_day - timedelta(days=1)).replace(day=1)
    next_month_start = (last_day + timedelta(days=1))

    return render(request, 'projects/calendar.html', {
        'year': year,
        'month': month,
        'month_name': py_calendar.month_name[month],
        'weeks': weeks,
        'weekday_labels': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        'prev_year': prev_month.year,
        'prev_month_num': prev_month.month,
        'next_year': next_month_start.year,
        'next_month_num': next_month_start.month,
        'selected_date': selected_date,
        'selected_tasks': selected_tasks,
        'month_total': month_total,
        'month_done': month_done,
        'month_overdue': month_overdue,
        'projects': Project.objects.filter(owner=request.user),
    })


@login_required
def project_create(request):
    if request.method == 'POST':
        form = ProjectForm(request.POST)
        if form.is_valid():
            project = form.save(commit=False)
            project.owner = request.user
            project.save()
            return redirect('project_detail', pk=project.pk)
    else:
        form = ProjectForm()
    return render(request, 'projects/project_form.html', {
        'form': form,
        'title': 'New Project',
    })


@login_required
def project_edit(request, pk):
    project = get_object_or_404(Project, pk=pk, owner=request.user)
    if request.method == 'POST':
        form = ProjectForm(request.POST, instance=project)
        if form.is_valid():
            form.save()
            return redirect('project_detail', pk=project.pk)
    else:
        form = ProjectForm(instance=project)
    return render(request, 'projects/project_form.html', {
        'form': form,
        'title': 'Edit Project',
        'project': project,
    })


@login_required
def project_delete(request, pk):
    project = get_object_or_404(Project, pk=pk, owner=request.user)
    if request.method == 'POST':
        project.delete()
        return redirect('dashboard')
    return redirect('project_detail', pk=pk)


@login_required
def project_detail(request, pk):
    project = get_object_or_404(Project, pk=pk, owner=request.user)

    # Filters
    status_filter = request.GET.get('status', 'all')
    priority_filter = request.GET.get('priority', 'all')
    sort_by = request.GET.get('sort', 'position')
    view_mode = request.GET.get('view', 'list')

    tasks = project.tasks.all()

    if status_filter != 'all':
        tasks = tasks.filter(status=status_filter)
    if priority_filter != 'all':
        tasks = tasks.filter(priority=priority_filter)

    sort_options = {
        'position': ['position', '-created_at'],
        'newest': ['-created_at'],
        'oldest': ['created_at'],
        'priority': ['-priority_order', '-created_at'],
        'due_date': ['due_date_null', 'due_date', '-created_at'],
        'alpha': ['title'],
    }

    if sort_by == 'priority':
        from django.db.models import Case, When, Value, IntegerField
        tasks = tasks.annotate(
            priority_order=Case(
                When(priority='high', then=Value(3)),
                When(priority='medium', then=Value(2)),
                When(priority='low', then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
        ).order_by('-priority_order', '-created_at')
    elif sort_by == 'due_date':
        from django.db.models import Case, When, Value, IntegerField
        tasks = tasks.annotate(
            due_date_null=Case(
                When(due_date__isnull=True, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
        ).order_by('due_date_null', 'due_date', '-created_at')
    elif sort_by in sort_options:
        tasks = tasks.order_by(*sort_options[sort_by])

    return render(request, 'projects/project_detail.html', {
        'project': project,
        'tasks': tasks,
        'status_filter': status_filter,
        'priority_filter': priority_filter,
        'sort_by': sort_by,
        'view_mode': view_mode,
        'today': date.today(),
    })


@login_required
def task_create(request, project_pk):
    project = get_object_or_404(Project, pk=project_pk, owner=request.user)
    if request.method == 'POST':
        form = TaskForm(request.POST)
        if form.is_valid():
            task = form.save(commit=False)
            task.project = project
            max_pos = project.tasks.aggregate(m=models.Max('position'))['m'] or 0
            task.position = max_pos + 1
            task.save()
            return redirect('project_detail', pk=project.pk)
    else:
        form = TaskForm()
    return render(request, 'projects/task_form.html', {
        'form': form,
        'project': project,
        'title': 'New Task',
    })


@login_required
def task_edit(request, project_pk, task_pk):
    project = get_object_or_404(Project, pk=project_pk, owner=request.user)
    task = get_object_or_404(Task, pk=task_pk, project=project)
    if request.method == 'POST':
        form = TaskForm(request.POST, instance=task)
        if form.is_valid():
            form.save()
            return redirect('project_detail', pk=project.pk)
    else:
        form = TaskForm(instance=task)
    return render(request, 'projects/task_form.html', {
        'form': form,
        'project': project,
        'task': task,
        'title': 'Edit Task',
    })


@login_required
def task_delete(request, project_pk, task_pk):
    project = get_object_or_404(Project, pk=project_pk, owner=request.user)
    task = get_object_or_404(Task, pk=task_pk, project=project)
    if request.method == 'POST':
        task.delete()
        return JsonResponse({'ok': True})
    return redirect('project_detail', pk=project.pk)


@login_required
@require_POST
def task_update_status(request, project_pk, task_pk):
    project = get_object_or_404(Project, pk=project_pk, owner=request.user)
    task = get_object_or_404(Task, pk=task_pk, project=project)
    data = json.loads(request.body)
    new_status = data.get('status')
    if new_status in dict(Task.STATUS_CHOICES):
        task.status = new_status
        task.save()
        return JsonResponse({
            'ok': True,
            'status': task.status,
            'progress': project.progress,
            'completed': project.completed_count,
            'total': project.task_count,
        })
    return JsonResponse({'ok': False}, status=400)


@login_required
@require_POST
def task_update_priority(request, project_pk, task_pk):
    project = get_object_or_404(Project, pk=project_pk, owner=request.user)
    task = get_object_or_404(Task, pk=task_pk, project=project)
    data = json.loads(request.body)
    new_priority = data.get('priority')
    if new_priority in dict(Task.PRIORITY_CHOICES):
        task.priority = new_priority
        task.save()
        return JsonResponse({'ok': True, 'priority': task.priority})
    return JsonResponse({'ok': False}, status=400)


# Import models at module level to use Max
from django.db import models

from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('projects/new/', views.project_create, name='project_create'),
    path('projects/<int:pk>/', views.project_detail, name='project_detail'),
    path('projects/<int:pk>/edit/', views.project_edit, name='project_edit'),
    path('projects/<int:pk>/delete/', views.project_delete, name='project_delete'),
    path('projects/<int:project_pk>/tasks/new/', views.task_create, name='task_create'),
    path('projects/<int:project_pk>/tasks/<int:task_pk>/edit/', views.task_edit, name='task_edit'),
    path('projects/<int:project_pk>/tasks/<int:task_pk>/delete/', views.task_delete, name='task_delete'),
    path('projects/<int:project_pk>/tasks/<int:task_pk>/status/', views.task_update_status, name='task_update_status'),
    path('projects/<int:project_pk>/tasks/<int:task_pk>/priority/', views.task_update_priority, name='task_update_priority'),
]

from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.CustomLogoutView.as_view(), name='logout'),
    path('register/', views.register_view, name='register'),
    path('verify-email/', views.verify_email_view, name='verify_email'),
    path('resend-email-code/', views.resend_email_code_view, name='resend_email_code'),
    path('forgot-password/', views.forgot_password_view, name='forgot_password'),
    path('verify-reset-code/', views.verify_reset_code_view, name='verify_reset_code'),
    path('resend-reset-code/', views.resend_reset_code_view, name='resend_reset_code'),
    path('reset-password/', views.reset_password_view, name='reset_password'),
]

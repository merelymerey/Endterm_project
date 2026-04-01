from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.views import LoginView, LogoutView
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.conf import settings
from .forms import RegisterForm, LoginForm, ForgotPasswordForm, VerifyResetCodeForm, ResetPasswordForm
from .models import PasswordResetCode


class CustomLoginView(LoginView):
    form_class = LoginForm
    template_name = 'accounts/login.html'
    redirect_authenticated_user = True


class CustomLogoutView(LogoutView):
    next_page = '/accounts/login/'


def register_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = User.objects.create_user(
                username=form.cleaned_data['username'],
                email=form.cleaned_data['email'],
                password=form.cleaned_data['password1'],
            )
            login(request, user)
            return redirect('dashboard')
    else:
        form = RegisterForm()
    return render(request, 'accounts/register.html', {'form': form})


def forgot_password_view(request):
    if request.method == 'POST':
        form = ForgotPasswordForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            user = User.objects.filter(email=email).first()
            if user:
                code = PasswordResetCode.generate_code()
                PasswordResetCode.objects.create(email=email, code=code)
                send_mail(
                    subject='Password Reset Code',
                    message=f'Your password reset code is: {code}',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                )
            request.session['reset_email'] = email
            return redirect('verify_reset_code')
    else:
        form = ForgotPasswordForm()
    return render(request, 'accounts/forgot_password.html', {'form': form})

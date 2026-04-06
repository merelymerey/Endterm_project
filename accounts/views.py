from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.views import LoginView, LogoutView
from django.contrib.auth.models import User

from .email import send_otp_email, send_verification_email
from .forms import (
    RegisterForm,
    LoginForm,
    ForgotPasswordForm,
    VerifyResetCodeForm,
    ResetPasswordForm,
    VerifyEmailCodeForm,
)
from .models import PasswordResetCode, EmailVerificationCode


class CustomLoginView(LoginView):
    form_class = LoginForm
    template_name = 'accounts/login.html'
    redirect_authenticated_user = True


class CustomLogoutView(LogoutView):
    next_page = '/accounts/login/'


# ── Registration with email verification ───────────────────────

def register_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            username = form.cleaned_data['username']
            password = form.cleaned_data['password1']

            code = EmailVerificationCode.generate_code()
            EmailVerificationCode.objects.create(
                email=email,
                username=username,
                password=password,
                code=code,
            )
            send_verification_email(email, code)

            request.session['verify_email'] = email
            return redirect('verify_email')
    else:
        form = RegisterForm()
    return render(request, 'accounts/register.html', {'form': form})


def verify_email_view(request):
    email = request.session.get('verify_email')
    if not email:
        return redirect('register')

    error = None
    if request.method == 'POST':
        form = VerifyEmailCodeForm(request.POST)
        if form.is_valid():
            code = form.cleaned_data['code']
            record = EmailVerificationCode.objects.filter(
                email=email, code=code, is_used=False
            ).order_by('-created_at').first()

            if not record:
                error = 'Invalid verification code.'
            elif record.is_expired():
                error = 'This code has expired. Please request a new one.'
            else:
                record.is_used = True
                record.save()

                user = User.objects.create_user(
                    username=record.username,
                    email=record.email,
                    password=record.password,
                )
                login(request, user)
                request.session.pop('verify_email', None)
                return redirect('dashboard')
    else:
        form = VerifyEmailCodeForm()

    return render(request, 'accounts/verify_email.html', {
        'form': form,
        'email': email,
        'error': error,
    })


def resend_email_code_view(request):
    email = request.session.get('verify_email')
    if email:
        record = EmailVerificationCode.objects.filter(
            email=email, is_used=False
        ).order_by('-created_at').first()
        if record:
            code = EmailVerificationCode.generate_code()
            EmailVerificationCode.objects.create(
                email=email,
                username=record.username,
                password=record.password,
                code=code,
            )
            send_verification_email(email, code)
    return redirect('verify_email')


# ── Password reset ─────────────────────────────────────────────

def forgot_password_view(request):
    if request.method == 'POST':
        form = ForgotPasswordForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            user = User.objects.filter(email=email).first()
            if user:
                code = PasswordResetCode.generate_code()
                PasswordResetCode.objects.create(email=email, code=code)
                send_otp_email(email, code)
            request.session['reset_email'] = email
            return redirect('verify_reset_code')
    else:
        form = ForgotPasswordForm()
    return render(request, 'accounts/forgot_password.html', {'form': form})


def verify_reset_code_view(request):
    email = request.session.get('reset_email')
    if not email:
        return redirect('forgot_password')

    error = None
    if request.method == 'POST':
        form = VerifyResetCodeForm(request.POST)
        if form.is_valid():
            code = form.cleaned_data['code']
            record = PasswordResetCode.objects.filter(
                email=email, code=code, is_used=False
            ).order_by('-created_at').first()

            if not record:
                error = 'Invalid verification code.'
            elif record.is_expired():
                error = 'This code has expired. Please request a new one.'
            else:
                record.is_used = True
                record.save()
                request.session['reset_verified'] = True
                return redirect('reset_password')
    else:
        form = VerifyResetCodeForm()

    return render(request, 'accounts/verify_reset_code.html', {
        'form': form,
        'email': email,
        'error': error,
    })


def resend_reset_code_view(request):
    email = request.session.get('reset_email')
    if email:
        user = User.objects.filter(email=email).first()
        if user:
            code = PasswordResetCode.generate_code()
            PasswordResetCode.objects.create(email=email, code=code)
            send_otp_email(email, code)
    return redirect('verify_reset_code')


def reset_password_view(request):
    email = request.session.get('reset_email')
    verified = request.session.get('reset_verified')
    if not email or not verified:
        return redirect('forgot_password')

    error = None
    if request.method == 'POST':
        form = ResetPasswordForm(request.POST)
        if form.is_valid():
            user = User.objects.filter(email=email).first()
            if user:
                user.set_password(form.cleaned_data['password1'])
                user.save()
                request.session.pop('reset_email', None)
                request.session.pop('reset_verified', None)
                return redirect('login')
            else:
                error = 'Account not found.'
    else:
        form = ResetPasswordForm()

    return render(request, 'accounts/reset_password.html', {
        'form': form,
        'error': error,
    })

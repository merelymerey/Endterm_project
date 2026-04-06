from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User


class RegisterForm(forms.Form):
    username = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': 'form-input',
            'placeholder': 'Username',
            'autocomplete': 'off',
        })
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-input',
            'placeholder': 'Email',
            'autocomplete': 'off',
        })
    )
    password1 = forms.CharField(
        label='Password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-input',
            'placeholder': 'Password',
        })
    )
    password2 = forms.CharField(
        label='Confirm password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-input',
            'placeholder': 'Confirm password',
        })
    )

    def clean_username(self):
        username = self.cleaned_data['username']
        if User.objects.filter(username=username).exists():
            raise forms.ValidationError('This username is already taken.')
        return username

    def clean_email(self):
        email = self.cleaned_data['email']
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError('This email is already registered.')
        return email

    def clean(self):
        cleaned = super().clean()
        p1 = cleaned.get('password1')
        p2 = cleaned.get('password2')
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError('Passwords do not match.')
        if p1 and len(p1) < 6:
            raise forms.ValidationError('Password must be at least 6 characters.')
        return cleaned



class ForgotPasswordForm(forms.Form):
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-input',
            'placeholder': 'Enter your email',
            'autocomplete': 'off',
        })
    )


class VerifyResetCodeForm(forms.Form):
    code = forms.CharField(
        max_length=6,
        min_length=6,
        widget=forms.TextInput(attrs={
            'class': 'form-input',
            'placeholder': '000000',
            'autocomplete': 'off',
            'maxlength': '6',
            'inputmode': 'numeric',
            'pattern': '[0-9]*',
            'style': 'text-align:center;font-size:1.8rem;font-weight:700;letter-spacing:0.3em;',
        })
    )


class ResetPasswordForm(forms.Form):
    password1 = forms.CharField(
        label='New password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-input',
            'placeholder': 'New password',
        })
    )
    password2 = forms.CharField(
        label='Confirm password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-input',
            'placeholder': 'Confirm new password',
        })
    )

    def clean(self):
        cleaned = super().clean()
        p1 = cleaned.get('password1')
        p2 = cleaned.get('password2')
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError('Passwords do not match.')
        if p1 and len(p1) < 6:
            raise forms.ValidationError('Password must be at least 6 characters.')
        return cleaned


class VerifyEmailCodeForm(forms.Form):
    code = forms.CharField(
        max_length=6,
        min_length=6,
        widget=forms.TextInput(attrs={
            'class': 'form-input',
            'placeholder': '000000',
            'autocomplete': 'off',
            'maxlength': '6',
            'inputmode': 'numeric',
            'pattern': '[0-9]*',
            'style': 'text-align:center;font-size:1.8rem;font-weight:700;letter-spacing:0.3em;',
        })
    )


class LoginForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name, field in self.fields.items():
            field.widget.attrs['class'] = 'form-input'
        self.fields['username'].label = 'Email or Username'
        self.fields['username'].widget.attrs['placeholder'] = 'Email or Username'
        self.fields['password'].widget.attrs['placeholder'] = 'Password'

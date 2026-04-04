import resend
from django.conf import settings


def send_otp_email(email, otp_code):
    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send({
        'from': settings.EMAIL_FROM,
        'to': [email],
        'subject': f'{otp_code} — your password reset code',
        'html': f'<p>Your code: <b>{otp_code}</b></p>',
    })

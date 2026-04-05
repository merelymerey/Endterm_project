import html

import resend
from django.conf import settings


def _build_otp_html(otp_code, title, description, security_note):
    escaped_otp = html.escape(otp_code)
    digit_cells = ''
    for d in escaped_otp:
        digit_cells += (
            '<td style="width:48px;height:56px;background-color:#1a1a1a;border:1px solid #333;'
            'border-radius:8px;text-align:center;vertical-align:middle;'
            "font-size:28px;font-weight:700;color:#ffffff;font-family:'SF Mono',Monaco,Consolas,monospace;"
            f'letter-spacing:2px;">{d}</td>'
        )
    return f'<body style="margin:0;padding:0;background-color:#000000;"><table width="100%"><tr><td align="center" style="padding:40px 20px;"><table width="480" style="max-width:480px;"><tr><td style="background-color:#16181c;border-radius:16px;padding:40px 36px;"><h1 style="color:#e7e9ea;">{html.escape(title)}</h1><p style="color:#71767b;">{html.escape(description)}</p><table cellspacing="6" style="margin:0 auto 28px auto;"><tr>{digit_cells}</tr></table><hr style="border:none;border-top:1px solid #2f3336;"><p style="color:#71767b;font-size:13px;">{html.escape(security_note)}</p></td></tr></table></td></tr></table></body>'


def send_otp_email(email, otp_code):
    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send({
        'from': settings.EMAIL_FROM,
        'to': [email],
        'subject': f'{otp_code} — your password reset code',
        'html': _build_otp_html(otp_code, 'Password reset', 'Enter this code to reset your password. The code expires in 10 minutes.', 'If you did not request this code, you can safely ignore this email.'),
    })

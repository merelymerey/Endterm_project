import html

import resend
from django.conf import settings


def _build_otp_html(otp_code: str, title: str, description: str, security_note: str) -> str:
    escaped_otp = html.escape(otp_code)

    digit_cells = ""
    for d in escaped_otp:
        digit_cells += (
            '<td style="width:48px;height:56px;background-color:#1a1a1a;border:1px solid #333;'
            "border-radius:8px;text-align:center;vertical-align:middle;"
            "font-size:28px;font-weight:700;color:#ffffff;font-family:'SF Mono',Monaco,Consolas,monospace;"
            f'letter-spacing:2px;">{d}</td>'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;min-height:100vh;">
        <tr>
            <td align="center" style="padding:40px 20px;">
                <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">

                    <tr>
                        <td align="center" style="padding-bottom:32px;">
                            <div style="width:48px;height:48px;background-color:#1d9bf0;border-radius:50%;display:inline-block;text-align:center;line-height:48px;">
                                <span style="font-size:22px;font-weight:800;color:#ffffff;font-family:Arial,sans-serif;">&#10003;</span>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color:#16181c;border-radius:16px;padding:40px 36px;">

                            <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#e7e9ea;line-height:1.3;">
                                {html.escape(title)}
                            </h1>

                            <p style="margin:0 0 28px 0;font-size:15px;color:#71767b;line-height:1.5;">
                                {html.escape(description)}
                            </p>

                            <table role="presentation" cellpadding="0" cellspacing="6" style="margin:0 auto 28px auto;">
                                <tr>
                                    {digit_cells}
                                </tr>
                            </table>

                            <hr style="border:none;border-top:1px solid #2f3336;margin:24px 0;">

                            <p style="margin:0;font-size:13px;color:#71767b;line-height:1.5;">
                                {html.escape(security_note)}
                            </p>

                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding-top:32px;">
                            <p style="margin:0 0 4px 0;font-size:13px;color:#333639;">
                                Todo App
                            </p>
                            <p style="margin:0;font-size:12px;color:#333639;">
                                This is an automated message. Please do not reply.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""


def send_otp_email(email: str, otp_code: str) -> None:
    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": [email],
        "subject": f"{otp_code} — your password reset code",
        "html": _build_otp_html(
            otp_code=otp_code,
            title="Password reset",
            description="Enter this code to reset your password. The code expires in 10 minutes.",
            security_note="If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.",
        ),
    })


def send_verification_email(email: str, otp_code: str) -> None:
    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": [email],
        "subject": f"{otp_code} — confirm your email",
        "html": _build_otp_html(
            otp_code=otp_code,
            title="Confirm your email",
            description="Welcome! Enter this code to verify your email address and activate your account. The code expires in 10 minutes.",
            security_note="If you didn't create an account, you can safely ignore this email.",
        ),
    })

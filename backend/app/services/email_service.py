import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EmailSendResult:
    sent: bool
    skipped: bool = False
    error: str | None = None


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def _build_candidate_invitation_text(payload: dict) -> str:
    return (
        f"Hello {payload['candidate_name']},\n\n"
        f"You have been invited to take {payload['exam_name']}.\n\n"
        "Login details:\n"
        f"Email: {payload['candidate_email']}\n"
        f"Password: {payload['temp_password']}\n"
        f"Login page: {payload['login_url']}\n\n"
        "Use the email address and password above to sign in. After login, you "
        "will be taken to the candidate exam page automatically.\n\n"
        "Regards,\n"
        "Online Exam Portal"
    )


def _build_candidate_invitation_html(payload: dict) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55">
      <p>Hello {payload['candidate_name']},</p>
      <p>You have been invited to take <strong>{payload['exam_name']}</strong>.</p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin:18px 0;background:#f9fafb">
        <p style="margin:0 0 8px"><strong>Email:</strong> {payload['candidate_email']}</p>
        <p style="margin:0 0 8px"><strong>Password:</strong> {payload['temp_password']}</p>
        <p style="margin:0"><strong>Login page:</strong> <a href="{payload['login_url']}">{payload['login_url']}</a></p>
      </div>
      <p>Use these credentials to sign in. After login, you will be taken to the candidate exam page automatically.</p>
      <p>Regards,<br/>Online Exam Portal</p>
    </div>
    """


def send_candidate_invitation(payload: dict) -> EmailSendResult:
    if not _smtp_configured():
        return EmailSendResult(
            sent=False,
            skipped=True,
            error="SMTP is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL to send invitations.",
        )

    message = EmailMessage()
    message["Subject"] = f"Exam login details: {payload['exam_name']}"
    message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL or ""))
    message["To"] = payload["candidate_email"]
    message.set_content(_build_candidate_invitation_text(payload))
    message.add_alternative(_build_candidate_invitation_html(payload), subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return EmailSendResult(sent=True)
    except Exception as exc:
        logger.warning("Candidate invitation email failed for %s: %s", payload["candidate_email"], exc)
        return EmailSendResult(sent=False, error=str(exc))


def _build_account_credentials_text(payload: dict) -> str:
    return (
        f"Hello {payload['full_name']},\n\n"
        f"Your {payload['role']} account has been created for the Online Exam Portal.\n\n"
        "Login details:\n"
        f"Email: {payload['email']}\n"
        f"Password: {payload['password']}\n"
        f"Login page: {payload['login_url']}\n\n"
        "Please sign in with these credentials.\n\n"
        "Regards,\n"
        "Online Exam Portal"
    )


def _build_account_credentials_html(payload: dict) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55">
      <p>Hello {payload['full_name']},</p>
      <p>Your <strong>{payload['role']}</strong> account has been created for the Online Exam Portal.</p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin:18px 0;background:#f9fafb">
        <p style="margin:0 0 8px"><strong>Email:</strong> {payload['email']}</p>
        <p style="margin:0 0 8px"><strong>Password:</strong> {payload['password']}</p>
        <p style="margin:0"><strong>Login page:</strong> <a href="{payload['login_url']}">{payload['login_url']}</a></p>
      </div>
      <p>Please sign in with these credentials.</p>
      <p>Regards,<br/>Online Exam Portal</p>
    </div>
    """


def send_account_credentials(payload: dict) -> EmailSendResult:
    if not _smtp_configured():
        return EmailSendResult(
            sent=False,
            skipped=True,
            error="SMTP is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL to send credentials.",
        )

    message = EmailMessage()
    message["Subject"] = f"Your Online Exam Portal {payload['role']} account"
    message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL or ""))
    message["To"] = payload["email"]
    message.set_content(_build_account_credentials_text(payload))
    message.add_alternative(_build_account_credentials_html(payload), subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return EmailSendResult(sent=True)
    except Exception as exc:
        logger.warning("Account credentials email failed for %s: %s", payload["email"], exc)
        return EmailSendResult(sent=False, error=str(exc))

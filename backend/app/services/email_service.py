
import logging
import os
from dataclasses import dataclass
from html import escape

import resend

logger = logging.getLogger(__name__)


@dataclass
class EmailSendResult:
    sent: bool
    skipped: bool = False
    error: str | None = None


def _resend_configured() -> bool:
    return bool(
        os.getenv("RESEND_API_KEY")
        and os.getenv("RESEND_FROM_EMAIL")
    )


def _send_email(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> EmailSendResult:
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM_EMAIL")

    if not api_key or not from_email:
        return EmailSendResult(
            sent=False,
            skipped=True,
            error=(
                "Resend is not configured. Set RESEND_API_KEY "
                "and RESEND_FROM_EMAIL in the backend environment."
            ),
        )

    try:
        resend.api_key = api_key

        response = resend.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "text": text_body,
            "html": html_body,
        })

        logger.info(
            "Email accepted by Resend for %s; response received",
            to_email,
        )
        return EmailSendResult(sent=True)

    except Exception as exc:
        logger.warning(
            "Email sending failed for %s: %s",
            to_email,
            exc,
        )
        return EmailSendResult(sent=False, error=str(exc))


def _build_candidate_invitation_text(payload: dict) -> str:
    return (
        f"Hello {payload['candidate_name']},\n\n"
        f"You have been invited to take {payload['exam_name']}.\n\n"
        "Login details:\n"
        f"Email: {payload['candidate_email']}\n"
        f"Password: {payload['temp_password']}\n"
        f"Login page: {payload['login_url']}\n\n"
        "Use these credentials to sign in. After login, you will "
        "be taken to the candidate exam page automatically.\n\n"
        "Regards,\n"
        "Online Exam Portal"
    )


def _build_candidate_invitation_html(payload: dict) -> str:
    name = escape(str(payload["candidate_name"]))
    exam = escape(str(payload["exam_name"]))
    email = escape(str(payload["candidate_email"]))
    password = escape(str(payload["temp_password"]))
    login_url = escape(str(payload["login_url"]), quote=True)

    return f"""
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55">
      <p>Hello {name},</p>
      <p>You have been invited to take <strong>{exam}</strong>.</p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;
                  padding:14px;margin:18px 0;background:#f9fafb">
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Password:</strong> {password}</p>
        <p><strong>Login page:</strong>
          <a href="{login_url}">{login_url}</a>
        </p>
      </div>
      <p>Use these credentials to sign in. After login, you will
         be taken to the candidate exam page automatically.</p>
      <p>Regards,<br/>Online Exam Portal</p>
    </div>
    """


def send_candidate_invitation(payload: dict) -> EmailSendResult:
    return _send_email(
        to_email=payload["candidate_email"],
        subject=f"Exam login details: {payload['exam_name']}",
        text_body=_build_candidate_invitation_text(payload),
        html_body=_build_candidate_invitation_html(payload),
    )


def _build_account_credentials_text(payload: dict) -> str:
    return (
        f"Hello {payload['full_name']},\n\n"
        f"Your {payload['role']} account has been created "
        "for the Online Exam Portal.\n\n"
        "Login details:\n"
        f"Email: {payload['email']}\n"
        f"Password: {payload['password']}\n"
        f"Login page: {payload['login_url']}\n\n"
        "Please sign in with these credentials.\n\n"
        "Regards,\n"
        "Online Exam Portal"
    )


def _build_account_credentials_html(payload: dict) -> str:
    name = escape(str(payload["full_name"]))
    role = escape(str(payload["role"]))
    email = escape(str(payload["email"]))
    password = escape(str(payload["password"]))
    login_url = escape(str(payload["login_url"]), quote=True)

    return f"""
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55">
      <p>Hello {name},</p>
      <p>Your <strong>{role}</strong> account has been created
         for the Online Exam Portal.</p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;
                  padding:14px;margin:18px 0;background:#f9fafb">
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Password:</strong> {password}</p>
        <p><strong>Login page:</strong>
          <a href="{login_url}">{login_url}</a>
        </p>
      </div>
      <p>Please sign in with these credentials.</p>
      <p>Regards,<br/>Online Exam Portal</p>
    </div>
    """


def send_account_credentials(payload: dict) -> EmailSendResult:
    return _send_email(
        to_email=payload["email"],
        subject=f"Your Online Exam Portal {payload['role']} account",
        text_body=_build_account_credentials_text(payload),
        html_body=_build_account_credentials_html(payload),
    )

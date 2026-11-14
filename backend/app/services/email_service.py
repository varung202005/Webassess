
import logging
import os
from dataclasses import dataclass
from html import escape

import httpx

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


@dataclass
class EmailSendResult:
    sent: bool
    skipped: bool = False
    error: str | None = None


def _brevo_configured() -> bool:
    return bool(
        os.getenv("BREVO_API_KEY")
        and os.getenv("BREVO_SENDER_EMAIL")
    )


def _send_email(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> EmailSendResult:

    api_key = os.getenv("BREVO_API_KEY")
    from_email = os.getenv("BREVO_SENDER_EMAIL")
    sender_name = os.getenv(
        "BREVO_SENDER_NAME",
        "WebAssess Exam Portal"
    )

    if not api_key or not from_email:
        return EmailSendResult(
            sent=False,
            skipped=True,
            error=(
                "Brevo is not configured. Set BREVO_API_KEY "
                "and BREVO_SENDER_EMAIL in backend environment."
            ),
        )

    payload = {
        "sender": {
            "name": sender_name,
            "email": from_email,
        },
        "to": [
            {"email": to_email}
        ],
        "subject": subject,
        "textContent": text_body,
        "htmlContent": html_body,
    }

    try:
        response = httpx.post(
            BREVO_API_URL,
            headers={
                "accept": "application/json",
                "api-key": api_key,
                "content-type": "application/json",
            },
            json=payload,
            timeout=20.0,
        )

        response.raise_for_status()

        result = response.json()

        logger.info(
            "Email accepted by Brevo for %s. Message ID: %s",
            to_email,
            result.get("messageId"),
        )

        return EmailSendResult(sent=True)

    except httpx.HTTPStatusError as exc:
        error_message = exc.response.text

        logger.warning(
            "Brevo API rejected email for %s: %s",
            to_email,
            error_message,
        )

        return EmailSendResult(
            sent=False,
            error=error_message,
        )

    except Exception as exc:
        logger.exception(
            "Email sending failed for %s",
            to_email,
        )

        return EmailSendResult(
            sent=False,
            error=str(exc),
        )


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
        "WebAssess Exam Portal"
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
      <p>Regards,<br/>WebAssess Exam Portal</p>
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
        "for the WebAssess Exam Portal.\n\n"
        "Login details:\n"
        f"Email: {payload['email']}\n"
        f"Password: {payload['password']}\n"
        f"Login page: {payload['login_url']}\n\n"
        "Please sign in with these credentials.\n\n"
        "Regards,\n"
        "WebAssess Exam Portal"
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
         for the WebAssess Exam Portal.</p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;
                  padding:14px;margin:18px 0;background:#f9fafb">
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Password:</strong> {password}</p>
        <p><strong>Login page:</strong>
          <a href="{login_url}">{login_url}</a>
        </p>
      </div>
      <p>Please sign in with these credentials.</p>
      <p>Regards,<br/>WebAssess Exam Portal</p>
    </div>
    """


def send_account_credentials(payload: dict) -> EmailSendResult:
    return _send_email(
        to_email=payload["email"],
        subject=f"Your WebAssess {payload['role']} account",
        text_body=_build_account_credentials_text(payload),
        html_body=_build_account_credentials_html(payload),
    )

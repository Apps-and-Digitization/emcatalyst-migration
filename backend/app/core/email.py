import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body_html: str, body_text: str = ""):
    """Send email via SMTP. Falls back to logging if SMTP_HOST not set."""
    from app.core.config import settings
    smtp_host = getattr(settings, "SMTP_HOST", None)
    if not smtp_host:
        logger.info(f"[EMAIL-LOG] To={to} | Subject={subject}\n{body_text or body_html[:300]}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = getattr(settings, "SMTP_FROM", "noreply@emcure.com")
        msg["To"] = to
        msg["Subject"] = subject
        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(smtp_host, getattr(settings, "SMTP_PORT", 587)) as server:
            server.starttls()
            smtp_user = getattr(settings, "SMTP_USER", "")
            smtp_pass = getattr(settings, "SMTP_PASSWORD", "")
            if smtp_user:
                server.login(smtp_user, smtp_pass)
            server.sendmail(msg["From"], [to], msg.as_string())
        return True
    except Exception as e:
        logger.error(f"[EMAIL-ERROR] To={to} | {e}")
        return False


def send_brs_survey_link(doctor_email: str, doctor_name: str, survey_title: str,
                          survey_link: str, honorarium_amount: float):
    subject = f"Bona Fide Research Survey Invitation — {survey_title}"
    body_html = f"""
<html><body style="font-family:Arial,sans-serif;color:#333;">
<div style="max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
  <div style="background:#003087;padding:24px;text-align:center;">
    <h2 style="color:#fff;margin:0;">Emcure Pharmaceuticals</h2>
    <p style="color:#adc8f0;margin:4px 0 0;">Bona Fide Research Survey</p>
  </div>
  <div style="padding:32px;">
    <p>Dear Dr. {doctor_name},</p>
    <p>You have been invited to participate in a <strong>Bona Fide Research Survey</strong>:</p>
    <div style="background:#f5f8ff;border-left:4px solid #003087;padding:16px;margin:16px 0;border-radius:4px;">
      <strong>{survey_title}</strong>
    </div>
    <p>Honorarium: <strong>₹{honorarium_amount:,.0f}</strong></p>
    <p>Please click the button below to review the agreement and complete the survey:</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="{survey_link}" style="background:#003087;color:#fff;padding:14px 32px;border-radius:6px;
         text-decoration:none;font-size:16px;font-weight:bold;">Open Survey →</a>
    </div>
    <p style="font-size:12px;color:#888;">If the button doesn't work, copy this link:<br>{survey_link}</p>
  </div>
  <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#999;">
    Emcure Pharmaceuticals Ltd. | This email is auto-generated.
  </div>
</div>
</body></html>
"""
    body_text = f"Dear Dr. {doctor_name},\n\nSurvey: {survey_title}\nHonorarium: ₹{honorarium_amount:,.0f}\nLink: {survey_link}"
    return send_email(doctor_email, subject, body_html, body_text)


def send_vendor_creation_notification(application_code: str, doctor_name: str,
                                       pan: str, bank_name: str, account_no: str, ifsc: str):
    subject = f"New Vendor Creation Required — BRS {application_code}"
    body_html = f"""
<html><body style="font-family:Arial,sans-serif;color:#333;">
<div style="max-width:600px;margin:auto;padding:24px;">
  <h3>Vendor Creation Required</h3>
  <p>A new BRS application requires vendor creation in SAP/MDM:</p>
  <table style="border-collapse:collapse;width:100%;">
    <tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;"><strong>BRS Code</strong></td>
        <td style="padding:8px;border:1px solid #ddd;">{application_code}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;"><strong>Doctor Name</strong></td>
        <td style="padding:8px;border:1px solid #ddd;">{doctor_name}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;"><strong>PAN</strong></td>
        <td style="padding:8px;border:1px solid #ddd;">{pan}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;"><strong>Bank Name</strong></td>
        <td style="padding:8px;border:1px solid #ddd;">{bank_name}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;"><strong>Account No</strong></td>
        <td style="padding:8px;border:1px solid #ddd;">{account_no}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;"><strong>IFSC</strong></td>
        <td style="padding:8px;border:1px solid #ddd;">{ifsc}</td></tr>
  </table>
  <p style="margin-top:16px;">Please create the vendor in SAP and update the BRS application accordingly.</p>
</div>
</body></html>
"""
    for email in ["yogesh.thakar@emcure.com", "anup.kumar@emcure.com"]:
        send_email(email, subject, body_html)

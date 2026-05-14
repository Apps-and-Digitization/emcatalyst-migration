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
        print(f"\n{'='*60}")
        print(f"📧 EMAIL TRIGGERED (SMTP not configured - logging only)")
        print(f"{'='*60}")
        print(f"  To:      {to}")
        print(f"  Subject: {subject}")
        print(f"  Body:    {body_text[:500] if body_text else body_html[:500]}")
        print(f"{'='*60}\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = getattr(settings, "SMTP_FROM", "noreply@emcure.com")
        msg["To"] = to
        msg["Subject"] = subject
        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        smtp_port = getattr(settings, "SMTP_PORT", 587)
        if smtp_port == 25:
            # Plain SMTP without TLS
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                smtp_user = getattr(settings, "SMTP_USER", "")
                smtp_pass = getattr(settings, "SMTP_PASSWORD", "")
                if smtp_user:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(msg["From"], [to], msg.as_string())
        else:
            # SMTP with STARTTLS (port 587)
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                smtp_user = getattr(settings, "SMTP_USER", "")
                smtp_pass = getattr(settings, "SMTP_PASSWORD", "")
                if smtp_user:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(msg["From"], [to], msg.as_string())
        print(f"✅ EMAIL SENT to {to} | Subject: {subject}")
        return True
    except Exception as e:
        print(f"❌ EMAIL FAILED to {to} | Error: {e}")
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


def send_brs_doctor_credentials(doctor_email: str, doctor_name: str, brs_code: str,
                                 survey_title: str, login_id: str, password: str,
                                 portal_url: str):
    """Send login credentials to doctor after Division Head approval"""
    subject = f"BRS Survey Access — {survey_title} ({brs_code})"
    body_html = f"""
<html><body style="font-family:Arial,sans-serif;color:#333;">
<div style="max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
  <div style="background:#003087;padding:24px;text-align:center;">
    <h2 style="color:#fff;margin:0;">Emcure Pharmaceuticals</h2>
    <p style="color:#adc8f0;margin:4px 0 0;">BRS Doctor Portal</p>
  </div>
  <div style="padding:32px;">
    <p>Dear Dr. {doctor_name},</p>
    <p>You have been selected to participate in a Bona Fide Research Survey. Your access credentials are below:</p>
    <div style="background:#f5f8ff;border:1px solid #d0dff5;padding:20px;margin:20px 0;border-radius:6px;">
      <p style="margin:0 0 8px;"><strong>Survey:</strong> {survey_title}</p>
      <p style="margin:0 0 8px;"><strong>BRS Code:</strong> {brs_code}</p>
      <hr style="border:none;border-top:1px solid #d0dff5;margin:12px 0;">
      <p style="margin:0 0 8px;"><strong>Login ID:</strong> <code style="background:#e8f0fe;padding:2px 8px;border-radius:3px;">{login_id}</code></p>
      <p style="margin:0;"><strong>Password:</strong> <code style="background:#e8f0fe;padding:2px 8px;border-radius:3px;">{password}</code></p>
    </div>
    <p>Please follow these steps:</p>
    <ol style="padding-left:20px;">
      <li>Click the button below to access the portal</li>
      <li>Login with the credentials above</li>
      <li>Update your personal details</li>
      <li>Sign the agreement</li>
      <li>Complete the survey</li>
    </ol>
    <div style="text-align:center;margin:32px 0;">
      <a href="{portal_url}" style="background:#003087;color:#fff;padding:14px 32px;border-radius:6px;
         text-decoration:none;font-size:16px;font-weight:bold;">Access Portal →</a>
    </div>
    <p style="font-size:12px;color:#888;">Portal URL: {portal_url}</p>
    <p style="font-size:12px;color:#888;">Please do not share your credentials with anyone.</p>
  </div>
  <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#999;">
    Emcure Pharmaceuticals Ltd. | This email is auto-generated.
  </div>
</div>
</body></html>
"""
    body_text = f"""Dear Dr. {doctor_name},

Survey: {survey_title}
BRS Code: {brs_code}

Login ID: {login_id}
Password: {password}

Portal: {portal_url}

Steps: Login → Update Details → Sign Agreement → Complete Survey
"""
    return send_email(doctor_email, subject, body_html, body_text)


def send_brs_credentials_to_territory_manager(
    tm_email: str, tm_name: str, brs_code: str, brs_title: str,
    survey_title: str, doctor_credentials: list, portal_url: str
):
    """Send one consolidated email to Territory Manager with all doctor credentials."""
    subject = f"BRS Approved — Doctor Credentials for {brs_title} ({brs_code})"

    # Build doctor table rows
    doctor_rows = ""
    for i, doc in enumerate(doctor_credentials, 1):
        doctor_rows += f"""
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px 8px;">{i}</td>
          <td style="padding:10px 8px;font-weight:bold;">{doc['doctor_name']}</td>
          <td style="padding:10px 8px;">{doc.get('email') or '—'}</td>
          <td style="padding:10px 8px;">{doc.get('mobile') or '—'}</td>
          <td style="padding:10px 8px;"><code style="background:#e8f0fe;padding:2px 6px;border-radius:3px;">{doc['login_id']}</code></td>
          <td style="padding:10px 8px;"><code style="background:#e8f0fe;padding:2px 6px;border-radius:3px;">{doc['password']}</code></td>
        </tr>"""

    body_html = f"""
<html><body style="font-family:Arial,sans-serif;color:#333;">
<div style="max-width:700px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
  <div style="background:#003087;padding:24px;text-align:center;">
    <h2 style="color:#fff;margin:0;">Emcure Pharmaceuticals</h2>
    <p style="color:#adc8f0;margin:4px 0 0;">BRS Doctor Credentials</p>
  </div>
  <div style="padding:32px;">
    <p>Dear {tm_name},</p>
    <p>The following BRS has been approved. Please share the login credentials with the respective doctors for survey completion.</p>
    <div style="background:#f5f8ff;border:1px solid #d0dff5;padding:16px;margin:16px 0;border-radius:6px;">
      <p style="margin:0 0 6px;"><strong>BRS Code:</strong> {brs_code}</p>
      <p style="margin:0 0 6px;"><strong>Title:</strong> {brs_title}</p>
      <p style="margin:0;"><strong>Survey:</strong> {survey_title}</p>
    </div>
    <h3 style="margin-top:24px;color:#003087;">Doctor Credentials ({len(doctor_credentials)} doctors)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #ddd;border-radius:6px;">
      <thead>
        <tr style="background:#f0f4f8;">
          <th style="padding:10px 8px;text-align:left;">#</th>
          <th style="padding:10px 8px;text-align:left;">Doctor Name</th>
          <th style="padding:10px 8px;text-align:left;">Email</th>
          <th style="padding:10px 8px;text-align:left;">Mobile</th>
          <th style="padding:10px 8px;text-align:left;">Login ID</th>
          <th style="padding:10px 8px;text-align:left;">Password</th>
        </tr>
      </thead>
      <tbody>
        {doctor_rows}
      </tbody>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="{portal_url}" style="background:#003087;color:#fff;padding:14px 32px;border-radius:6px;
         text-decoration:none;font-size:16px;font-weight:bold;">Doctor Portal →</a>
    </div>
    <p style="font-size:12px;color:#888;">Portal URL: {portal_url}</p>
    <p style="font-size:12px;color:#888;">Please ensure doctors complete the survey within the stipulated time.</p>
  </div>
  <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#999;">
    Emcure Pharmaceuticals Ltd. | This email is auto-generated.
  </div>
</div>
</body></html>
"""

    body_text = f"""Dear {tm_name},

BRS {brs_code} - {brs_title} has been approved.
Survey: {survey_title}

Doctor Credentials:
""" + "\n".join([
        f"  {i+1}. {doc['doctor_name']} | Login: {doc['login_id']} | Password: {doc['password']}"
        for i, doc in enumerate(doctor_credentials)
    ]) + f"""

Portal URL: {portal_url}

Please share these credentials with the respective doctors.
"""

    send_email(tm_email, subject, body_html, body_text)

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
<html><body style="font-family:'Poppins',Arial,sans-serif;color:#212529;background:#f8f9fa;margin:0;padding:24px;">
<div style="max-width:600px;margin:auto;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.10);">
  <div style="background:#ed1c24;padding:28px;text-align:center;">
    <h2 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">EMCatalyst</h2>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:12px;">Bona Fide Research Survey</p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:15px;margin:0 0 16px;">Dear <strong>Dr. {doctor_name}</strong>,</p>
    <p style="font-size:14px;color:#6c757d;line-height:1.6;">You have been invited to participate in a Bona Fide Research Survey:</p>
    <div style="background:#fff0f0;border-left:4px solid #ed1c24;padding:16px;margin:20px 0;border-radius:8px;">
      <strong style="font-size:15px;color:#212529;">{survey_title}</strong>
    </div>
    <p style="font-size:14px;color:#212529;">Honorarium: <strong style="color:#ed1c24;">₹{honorarium_amount:,.0f}</strong></p>
    <p style="font-size:14px;color:#6c757d;">Please click the button below to review the agreement and complete the survey:</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="{survey_link}" style="background:#ed1c24;color:#fff;padding:14px 32px;border-radius:9999px;
         text-decoration:none;font-size:14px;font-weight:600;display:inline-block;box-shadow:0 4px 16px rgba(237,28,36,.25);">Open Survey →</a>
    </div>
    <p style="font-size:11px;color:#ced4da;word-break:break-all;">If the button doesn't work, copy this link:<br>{survey_link}</p>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;font-size:11px;color:#adb5bd;border-top:1px solid #e9ecef;">
    © Emcure Pharmaceuticals Ltd. | This email is auto-generated.
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
<html><body style="font-family:'Poppins',Arial,sans-serif;color:#212529;background:#f8f9fa;margin:0;padding:24px;">
<div style="max-width:600px;margin:auto;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.10);">
  <div style="background:#ed1c24;padding:28px;text-align:center;">
    <h2 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">EMCatalyst</h2>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:12px;">Vendor Creation Required</p>
  </div>
  <div style="padding:32px;">
    <h3 style="font-size:16px;font-weight:600;margin:0 0 12px;color:#212529;">Vendor Creation Required</h3>
    <p style="font-size:14px;color:#6c757d;line-height:1.6;">A new BRS application requires vendor creation in SAP/MDM:</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;border-radius:8px;overflow:hidden;border:1px solid #e9ecef;">
      <tr><td style="padding:10px 12px;border-bottom:1px solid #e9ecef;background:#f8f9fa;font-size:13px;font-weight:600;width:35%;">BRS Code</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;font-size:13px;">{application_code}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #e9ecef;background:#f8f9fa;font-size:13px;font-weight:600;">Doctor Name</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;font-size:13px;">{doctor_name}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #e9ecef;background:#f8f9fa;font-size:13px;font-weight:600;">PAN</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;font-size:13px;">{pan}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #e9ecef;background:#f8f9fa;font-size:13px;font-weight:600;">Bank Name</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;font-size:13px;">{bank_name}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #e9ecef;background:#f8f9fa;font-size:13px;font-weight:600;">Account No</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;font-size:13px;">{account_no}</td></tr>
      <tr><td style="padding:10px 12px;background:#f8f9fa;font-size:13px;font-weight:600;">IFSC</td>
          <td style="padding:10px 12px;font-size:13px;">{ifsc}</td></tr>
    </table>
    <p style="font-size:14px;color:#6c757d;">Please create the vendor in SAP and update the BRS application accordingly.</p>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;font-size:11px;color:#adb5bd;border-top:1px solid #e9ecef;">
    © Emcure Pharmaceuticals Ltd. | This email is auto-generated.
  </div>
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
<html><body style="font-family:'Poppins',Arial,sans-serif;color:#212529;background:#f8f9fa;margin:0;padding:24px;">
<div style="max-width:600px;margin:auto;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.10);">
  <div style="background:#ed1c24;padding:28px;text-align:center;">
    <h2 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">EMCatalyst</h2>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:12px;">BRS Doctor Portal</p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:15px;margin:0 0 16px;">Dear <strong>Dr. {doctor_name}</strong>,</p>
    <p style="font-size:14px;color:#6c757d;line-height:1.6;">You have been selected to participate in a Bona Fide Research Survey. Your access credentials are below:</p>
    <div style="background:#fff0f0;border:1px solid #ffd6d6;padding:20px;margin:20px 0;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:14px;"><strong>Survey:</strong> {survey_title}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>BRS Code:</strong> {brs_code}</p>
      <hr style="border:none;border-top:1px solid #ffd6d6;margin:12px 0;">
      <p style="margin:0 0 8px;font-size:14px;"><strong>Login ID:</strong> <code style="background:#fff0f0;border:1px solid #ffadad;padding:3px 10px;border-radius:4px;font-size:13px;">{login_id}</code></p>
      <p style="margin:0;font-size:14px;"><strong>Password:</strong> <code style="background:#fff0f0;border:1px solid #ffadad;padding:3px 10px;border-radius:4px;font-size:13px;">{password}</code></p>
    </div>
    <p style="font-size:14px;color:#212529;font-weight:600;margin:20px 0 12px;">Steps to complete:</p>
    <ol style="padding-left:20px;font-size:14px;color:#6c757d;line-height:2;">
      <li>Click the button below to access the portal</li>
      <li>Login with the credentials above</li>
      <li>Update your personal details</li>
      <li>Sign the agreement</li>
      <li>Complete the survey</li>
    </ol>
    <div style="text-align:center;margin:32px 0;">
      <a href="{portal_url}" style="background:#ed1c24;color:#fff;padding:14px 32px;border-radius:9999px;
         text-decoration:none;font-size:14px;font-weight:600;display:inline-block;box-shadow:0 4px 16px rgba(237,28,36,.25);">Access Portal →</a>
    </div>
    <p style="font-size:11px;color:#ced4da;word-break:break-all;">Portal URL: {portal_url}</p>
    <p style="font-size:12px;color:#adb5bd;">Please do not share your credentials with anyone.</p>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;font-size:11px;color:#adb5bd;border-top:1px solid #e9ecef;">
    © Emcure Pharmaceuticals Ltd. | This email is auto-generated.
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
        <tr style="border-bottom:1px solid #e9ecef;">
          <td style="padding:10px 8px;font-size:13px;">{i}</td>
          <td style="padding:10px 8px;font-size:13px;font-weight:600;">{doc['doctor_name']}</td>
          <td style="padding:10px 8px;font-size:13px;color:#6c757d;">{doc.get('email') or '—'}</td>
          <td style="padding:10px 8px;font-size:13px;color:#6c757d;">{doc.get('mobile') or '—'}</td>
          <td style="padding:10px 8px;"><code style="background:#fff0f0;border:1px solid #ffadad;padding:2px 6px;border-radius:4px;font-size:12px;">{doc['login_id']}</code></td>
          <td style="padding:10px 8px;"><code style="background:#fff0f0;border:1px solid #ffadad;padding:2px 6px;border-radius:4px;font-size:12px;">{doc['password']}</code></td>
        </tr>"""

    body_html = f"""
<html><body style="font-family:'Poppins',Arial,sans-serif;color:#212529;background:#f8f9fa;margin:0;padding:24px;">
<div style="max-width:700px;margin:auto;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.10);">
  <div style="background:#ed1c24;padding:28px;text-align:center;">
    <h2 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">EMCatalyst</h2>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:12px;">BRS Doctor Credentials</p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:15px;margin:0 0 16px;">Dear <strong>{tm_name}</strong>,</p>
    <p style="font-size:14px;color:#6c757d;line-height:1.6;">The following BRS has been approved. Please share the login credentials with the respective doctors for survey completion.</p>
    <div style="background:#fff0f0;border:1px solid #ffd6d6;padding:16px;margin:20px 0;border-radius:12px;">
      <p style="margin:0 0 6px;font-size:14px;"><strong>BRS Code:</strong> {brs_code}</p>
      <p style="margin:0 0 6px;font-size:14px;"><strong>Title:</strong> {brs_title}</p>
      <p style="margin:0;font-size:14px;"><strong>Survey:</strong> {survey_title}</p>
    </div>
    <h3 style="margin-top:24px;color:#ed1c24;font-size:15px;font-weight:600;">Doctor Credentials ({len(doctor_credentials)} doctors)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e9ecef;border-radius:8px;overflow:hidden;margin-top:12px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6c757d;font-weight:600;">#</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6c757d;font-weight:600;">Doctor Name</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6c757d;font-weight:600;">Email</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6c757d;font-weight:600;">Mobile</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6c757d;font-weight:600;">Login ID</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6c757d;font-weight:600;">Password</th>
        </tr>
      </thead>
      <tbody>
        {doctor_rows}
      </tbody>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="{portal_url}" style="background:#ed1c24;color:#fff;padding:14px 32px;border-radius:9999px;
         text-decoration:none;font-size:14px;font-weight:600;display:inline-block;box-shadow:0 4px 16px rgba(237,28,36,.25);">Doctor Portal →</a>
    </div>
    <p style="font-size:11px;color:#ced4da;word-break:break-all;">Portal URL: {portal_url}</p>
    <p style="font-size:12px;color:#adb5bd;">Please ensure doctors complete the survey within the stipulated time.</p>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;font-size:11px;color:#adb5bd;border-top:1px solid #e9ecef;">
    © Emcure Pharmaceuticals Ltd. | This email is auto-generated.
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

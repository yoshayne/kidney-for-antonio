const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const COORDINATOR_EMAIL = process.env.DONOR_COORDINATOR_EMAIL || 'Chesley.bishop@Prismahealth.org';
// Gets a copy of every website notification (form submissions, etc.) alongside the coordinator.
const NOTIFY_EMAIL = process.env.SITE_NOTIFY_EMAIL || 'Kidney4Tee2@gmail.com';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Pleasedonate@kidneyforantonio.com';
const FROM_NAME = process.env.FROM_NAME || 'Kidney For Antonio';

const emailConfigured = Boolean(BREVO_API_KEY);

if (!emailConfigured) {
  console.warn('Email is not configured — set BREVO_API_KEY to enable the donor questionnaire.');
}

async function sendEmail({ to, bcc, subject, html, replyTo }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      ...(bcc ? { bcc: [{ email: bcc }] } : {}),
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo API error ${response.status}: ${body}`);
  }
}

app.use(express.json({ limit: '256kb' }));
app.use(express.static(__dirname));

// Very small in-memory rate limiter: a handful of submissions per IP per hour
// is normal for a family fundraising site; this just discourages abuse.
const submissionLog = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (submissionLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  submissionLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function yesNo(value) {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return '—';
}

function row(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<tr><td style="padding:6px 12px;color:#52625A;white-space:nowrap;">${esc(label)}</td><td style="padding:6px 12px;">${esc(value)}</td></tr>`;
}

function buildMedicationsTable(medications) {
  const rows = (Array.isArray(medications) ? medications : [])
    .filter((m) => m && (m.medication || m.dose || m.frequency))
    .map(
      (m) =>
        `<tr><td style="padding:6px 12px;border:1px solid #ddd;">${esc(m.medication)}</td><td style="padding:6px 12px;border:1px solid #ddd;">${esc(m.dose)}</td><td style="padding:6px 12px;border:1px solid #ddd;">${esc(m.frequency)}</td></tr>`
    )
    .join('');
  if (!rows) return '<p style="color:#52625A;">None listed.</p>';
  return `<table style="border-collapse:collapse;width:100%;margin-top:6px;">
    <tr><th style="text-align:left;padding:6px 12px;border:1px solid #ddd;">Medication</th><th style="text-align:left;padding:6px 12px;border:1px solid #ddd;">Dose</th><th style="text-align:left;padding:6px 12px;border:1px solid #ddd;">Frequency</th></tr>
    ${rows}
  </table>`;
}

function buildEmailHtml(d) {
  const ssn = [d.ssn1, d.ssn2, d.ssn3].filter(Boolean).join('-');
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1C2620;max-width:640px;">
    <h2 style="color:#16332B;">Living Donor Questionnaire Submission</h2>
    <p>Submitted through the Kidney For Antonio website on ${esc(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))} (Eastern).</p>

    <h3>Donor Information</h3>
    <table style="border-collapse:collapse;width:100%;">
      ${row('Name', d.fullName)}
      ${row('Date of Birth', d.dob)}
      ${row('Address', d.address)}
      ${row('City / State / Zip', [d.city, d.state, d.zip].filter(Boolean).join(', '))}
      ${row('Phone', d.phone)}
      ${row('Email', d.email)}
      ${row('SSN', ssn)}
      ${row('Gender', d.gender)}
      ${row('Race', d.race)}
      ${row('Preferred Contact', d.preferredContact)}
      ${row('Prisma MRN', d.prismaMrn)}
      ${row('Has Health Insurance', yesNo(d.hasInsurance))}
      ${row('Primary Care Physician', d.pcpName)}
      ${row('PCP Address & Phone', d.pcpAddressPhone)}
    </table>

    <h3>Recipient Information</h3>
    <table style="border-collapse:collapse;width:100%;">
      ${row('Recipient Name', d.recipientName)}
      ${row('Recipient DOB', d.recipientDob)}
      ${row('Met the recipient?', yesNo(d.metRecipient))}
      ${row('Recipient knows?', yesNo(d.recipientKnows))}
      ${row('Relationship', d.relationship === 'family' ? `Family (${d.relationshipDetail || '—'})` : d.relationship === 'other' ? `Other (${d.relationshipOther || '—'})` : d.relationship)}
      ${row('No specific person in mind', d.noSpecificPerson ? 'Yes' : '')}
    </table>

    <h3>Health History</h3>
    <table style="border-collapse:collapse;width:100%;">
      ${row('Height', d.height)}
      ${row('Weight', d.weight ? `${d.weight} ${d.weightUnit || ''}` : '')}
      ${row('Blood Type', d.bloodType)}
      ${row('High Blood Pressure', yesNo(d.highBloodPressure))}
      ${row('Diabetes', yesNo(d.diabetes))}
      ${row('Diabetic Family Members', d.diabeticFamilyCount)}
      ${row('Arthritis', yesNo(d.arthritis))}
      ${row('Lupus', yesNo(d.lupus))}
      ${row('Ever Pregnant', yesNo(d.everPregnant))}
      ${row('Number of Pregnancies', d.numPregnancies)}
      ${row('Gestational Diabetes / Pre-eclampsia', yesNo(d.gestationalIssues))}
      ${row('Kidney Problems', yesNo(d.kidneyProblems))}
      ${row('Kidney Stone', yesNo(d.kidneyStone))}
      ${row('Heart Attack', yesNo(d.heartAttack))}
      ${row('Heart Surgery / Stents', yesNo(d.heartSurgeryStents))}
      ${row('Cancer', yesNo(d.cancer))}
      ${row('Cancer Type / Treatment', d.cancerDetail)}
      ${row('Abdominal Surgery', yesNo(d.abdominalSurgery))}
      ${row('Abdominal Surgery Type', d.abdominalSurgeryDetail)}
      ${row('Psychiatric Hospitalization', yesNo(d.psychHospitalization))}
      ${row('Attempted Self-Harm', yesNo(d.selfHarmAttempt))}
      ${row('Tobacco Use', yesNo(d.tobaccoUse))}
      ${row('Former Smoker Details', d.formerSmokerDetail)}
      ${row('Alcohol Use', yesNo(d.alcoholUse))}
      ${row('Alcohol Details', d.alcoholDetail)}
      ${row('Recreational / Illegal Drug Use (past year)', yesNo(d.recreationalDrugs))}
      ${row('Non-medical Prescription Use (past year)', yesNo(d.prescriptionMisuse))}
      ${row('Mammogram', d.mammogram)}
      ${row('Pap Smear', d.papSmear)}
      ${row('Colonoscopy', d.colonoscopy)}
      ${row('PSA', d.psa)}
      ${row('Willing to Accept Blood Products', d.bloodProducts)}
      ${row('Other Health Concerns', d.otherHealthConcerns)}
    </table>

    <h3>Medications</h3>
    ${buildMedicationsTable(d.medications)}

    <h3>Signature</h3>
    <table style="border-collapse:collapse;width:100%;">
      ${row('Typed Signature', d.signatureName)}
      ${row('Date', d.signatureDate)}
    </table>
  </div>`;
}

app.post('/api/donor-questionnaire', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: 'Too many submissions from this connection. Please try again later.' });
    }

    const data = req.body || {};

    // Honeypot: real visitors never fill this hidden field.
    if (data.website) {
      return res.json({ ok: true });
    }

    if (!data.fullName || !data.dob || !(data.phone || data.email)) {
      return res.status(400).json({ error: 'Please fill in your name, date of birth, and at least one way to reach you.' });
    }

    if (!data.signatureName || !data.agreeCertify) {
      return res.status(400).json({ error: 'Please type your name as your signature and confirm the certification checkbox.' });
    }

    if (!emailConfigured) {
      return res.status(503).json({ error: 'Online submission is not turned on yet. Please use the downloadable PDF for now.' });
    }

    const html = buildEmailHtml(data);

    await sendEmail({
      to: COORDINATOR_EMAIL,
      bcc: NOTIFY_EMAIL,
      replyTo: data.email || undefined,
      subject: `Living Donor Questionnaire — ${data.fullName}`,
      html,
    });

    if (data.email) {
      await sendEmail({
        to: data.email,
        subject: 'Your Living Donor Questionnaire submission',
        html: `<p>Thank you for completing the Living Donor Questionnaire for Antonio. Your answers were sent directly to Prisma Health's Living Donor Coordinator, who will reach out to you.</p>
               <p>Here is a copy of what you submitted for your records:</p>${html}`,
      });
    }

    console.log(`Donor questionnaire email sent at ${new Date().toISOString()}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to send donor questionnaire email:', err.message);
    res.status(500).json({ error: 'Something went wrong sending your questionnaire. Please try again, or use the downloadable PDF.' });
  }
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`Kidney For Antonio site running on port ${PORT}`);
});

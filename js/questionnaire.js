const form = document.getElementById('donor-form');
const statusBox = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');
const addMedicationBtn = document.getElementById('add-medication');
const medicationsRows = document.getElementById('medications-rows');

addMedicationBtn.addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'medication-row';
  row.innerHTML = `
    <input type="text" name="medication" placeholder="Medication">
    <input type="text" name="dose" placeholder="Dose">
    <input type="text" name="frequency" placeholder="Frequency">
  `;
  medicationsRows.appendChild(row);
});

function showStatus(kind, message) {
  statusBox.className = `form-status ${kind}`;
  statusBox.textContent = message;
  statusBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function collectFormData() {
  const formData = new FormData(form);
  const data = {};

  form.querySelectorAll('input, textarea').forEach((el) => {
    if (el.name === 'medication' || el.name === 'dose' || el.name === 'frequency') return;
    if (el.type === 'checkbox') {
      data[el.name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
    } else {
      data[el.name] = el.value.trim();
    }
  });

  data.medications = Array.from(medicationsRows.querySelectorAll('.medication-row')).map((row) => ({
    medication: row.querySelector('[name="medication"]').value.trim(),
    dose: row.querySelector('[name="dose"]').value.trim(),
    frequency: row.querySelector('[name="frequency"]').value.trim(),
  }));

  return data;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!form.reportValidity()) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  showStatus('pending', 'Sending your questionnaire to the donor coordinator…');

  try {
    const response = await fetch('/api/donor-questionnaire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectFormData()),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Something went wrong. Please try again.');
    }

    showStatus('success', "Thank you! Your questionnaire was sent to Prisma Health's Living Donor Coordinator. If you entered an email address, a copy was sent to you as well.");
    form.reset();
  } catch (err) {
    showStatus('error', err.message || 'Something went wrong sending your questionnaire. Please try again, or use the downloadable PDF above.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send My Questionnaire to the Donor Coordinator';
  }
});

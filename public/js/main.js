// Library Issue and Service Request System - Client Scripts

document.addEventListener('DOMContentLoaded', () => {
  // Auto-dismiss alerts after 6 seconds
  const alerts = document.querySelectorAll('.alert-dismissible');
  alerts.forEach(alert => {
    setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }, 6000);
  });

  // Dynamic Service Request Form Handler
  const requestTypeSelect = document.getElementById('requestTypeSelect');
  if (requestTypeSelect) {
    const reservationSection = document.getElementById('reservationFields');
    const renewalSection = document.getElementById('renewalFields');
    const suggestionSection = document.getElementById('suggestionFields');
    const complaintSection = document.getElementById('complaintFields');

    function updateRequestFields() {
      const selectedType = requestTypeSelect.value;
      if (reservationSection) reservationSection.style.display = selectedType === 'RESERVATION' ? 'block' : 'none';
      if (renewalSection) renewalSection.style.display = selectedType === 'RENEWAL' ? 'block' : 'none';
      if (suggestionSection) suggestionSection.style.display = selectedType === 'SUGGESTION' ? 'block' : 'none';
      if (complaintSection) complaintSection.style.display = (selectedType === 'COMPLAINT' || selectedType === 'RESERVATION' || selectedType === 'RENEWAL') ? 'block' : 'block';
    }

    requestTypeSelect.addEventListener('change', updateRequestFields);
    updateRequestFields();
  }
});

// Quick demo login fill helper
function fillDemoLogin(email, password) {
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  if (emailInput && passInput) {
    emailInput.value = email;
    passInput.value = password;
  }
}

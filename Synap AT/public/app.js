document.getElementById('year').textContent = new Date().getFullYear();
const form = document.getElementById('review-form');
const status = document.getElementById('form-status');
document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
  const choice = [...form.querySelectorAll('[name=services]')].find(input => input.value === link.dataset.service);
  if (choice) choice.checked = true;
}));
form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(form);
  const services = data.getAll('services');
  status.className = '';
  if (!services.length) { status.textContent = 'Please select at least one review area.'; status.className = 'error'; form.querySelector('[name=services]').focus(); return; }
  const button = form.querySelector('button');
  button.disabled = true; button.textContent = 'Sending your request…'; form.setAttribute('aria-busy', 'true');
  status.textContent = '';
  try {
    const response = await fetch('/api/enquiries', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(data),services,consent:data.get('consent') === 'on'}),signal:AbortSignal.timeout(15000)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to send your request. Please try again.');
    status.textContent = 'Thank you. Your request has been received. We’ll contact you to discuss your review.';
    status.className = 'success'; form.reset();
  } catch (error) { status.textContent = error.name === 'TimeoutError' ? 'The connection timed out. Please try again.' : (error.message === 'Failed to fetch' ? 'Unable to connect. Please check your connection and try again.' : error.message); status.className = 'error'; }
  finally { button.disabled = false; button.innerHTML = 'Request my review <span>↗</span>'; form.removeAttribute('aria-busy'); }
});

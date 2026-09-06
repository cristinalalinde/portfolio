// Keep the original SVG typography and spacing while animating without Squarespace.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const marquees = [...document.querySelectorAll('.Marquee')].map(element => {
  const text = element.querySelector('textPath.Marquee-svg-text');
  const spans = [...text.children];
  const cycle = Number(spans[2].getAttribute('x'));
  const secondOffset = Number(spans[1].getAttribute('x'));
  const originals = spans.slice(0, 2);
  text.replaceChildren();
  for (let i = 0; i < 30; i++) {
    originals.forEach((original, j) => {
      const span = original.cloneNode(true);
      span.setAttribute('x', i * cycle + (j ? secondOffset : 0));
      text.append(span);
    });
  }
  element.querySelector('.Marquee-path').setAttribute('d', 'M-550,30.452 L20000,30.452');
  return { element, text, cycle, offset: Number(text.getAttribute('startOffset')) || 0 };
});
let previous;
function animate(time) {
  const elapsed = previous === undefined ? 0 : Math.min(time - previous, 100);
  previous = time;
  if (!reduceMotion.matches && !document.hidden) {
    marquees.forEach(marquee => {
      marquee.offset = (marquee.offset - elapsed * .03) % marquee.cycle;
      marquee.text.setAttribute('startOffset', marquee.offset);
    });
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// The original client captions scale with their column's share of the viewport.
const clientTitles = [...document.querySelectorAll('.image-title.sqs-dynamic-text')];
function resizeCaptions() {
  clientTitles.forEach(title => {
    const width = title.closest('.sqs-block-content').getBoundingClientRect().width;
    title.style.fontSize = `max(0.75rem, ${(width / innerWidth * 100).toFixed(1)}%)`;
  });
}
new ResizeObserver(resizeCaptions).observe(document.documentElement);
resizeCaptions();

const toggle = document.querySelector('#mobileNavToggle');
const toggleLabel = document.querySelector('.mobile-nav-toggle-label');
toggle?.addEventListener('change', () => toggleLabel.setAttribute('aria-expanded', String(toggle.checked)));
toggleLabel?.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle.click(); }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle?.checked) toggle.click();
});

const form = document.querySelector('#contact-form');
const status = document.querySelector('#form-status');
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  status.hidden = true;
  status.className = '';
  button.disabled = true;
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Please try again.');
    form.hidden = true;
    status.textContent = 'Thank you!';
  } catch (error) {
    status.className = 'error';
    status.textContent = error instanceof TypeError ? 'Unable to submit. Check your connection and try again.' : error.message;
  } finally {
    status.hidden = false;
    button.disabled = false;
  }
});

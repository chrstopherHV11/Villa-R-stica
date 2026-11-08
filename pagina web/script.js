// Villa Rústica — interacciones básicas
(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');

  // Año en el pie de página
  document.getElementById('year').textContent = new Date().getFullYear();

  // Borde del encabezado al hacer scroll
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menú móvil
  const closeMenu = () => {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú');
  };
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

  // Filtro del catálogo
  const chips = document.querySelectorAll('.chip');
  const cards = document.querySelectorAll('.card');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.toggle('is-active', c === chip));
      const filter = chip.dataset.filter;
      cards.forEach((card) => {
        card.hidden = filter !== 'todos' && card.dataset.cat !== filter;
      });
    });
  });

  // Aparición suave al hacer scroll
  const revealEls = document.querySelectorAll('.section-head, .split > *, .card, .steps li, .features li');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  // Formulario de contacto (sin servidor: abre el cliente de correo)
  const form = document.getElementById('contact-form');
  const status = form.querySelector('.form-status');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    form.querySelectorAll('[required]').forEach((input) => {
      const ok = input.value.trim() !== '' && input.checkValidity();
      input.closest('.field').classList.toggle('invalid', !ok);
      if (!ok) valid = false;
    });

    if (!valid) {
      status.className = 'form-status error';
      status.textContent = 'Por favor, completa los campos obligatorios con datos válidos.';
      return;
    }

    const data = new FormData(form);
    const subject = `Solicitud de degustación — ${data.get('restaurant')}`;
    const body = [
      `Nombre: ${data.get('name')}`,
      `Restaurante: ${data.get('restaurant')}`,
      `Correo: ${data.get('email')}`,
      '',
      data.get('message') || '',
    ].join('\n');

    window.location.href = `mailto:contacto@villarustica.example?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.className = 'form-status ok';
    status.textContent = '¡Gracias! Se abrirá tu correo para enviar la solicitud.';
    form.reset();
  });
})();

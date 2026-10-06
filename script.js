"use strict";

// ВСТАВЬ URL веб-приложения Google Apps Script между кавычками.
// Он начинается с https://script.google.com/macros/s/ и заканчивается /exec.
// Это тот же адрес, через который уже работают заявки CarStar/CasaStar.
const GOOGLE_SCRIPT_URL = "";

(() => {
  const serviceNames = {
    sofa: "Բազմոց",
    armchair: "Բազկաթոռ",
    mattress: "Ներքնակ",
    chair: "Աթոռ",
  };
  const services = Object.keys(serviceNames);
  const form = document.getElementById("booking-form");
  const submitButton = document.getElementById("booking-submit");
  const errorBox = document.getElementById("booking-error");
  const successPanel = document.getElementById("booking-success");
  const minus = document.getElementById("quantity-minus");
  const plus = document.getElementById("quantity-plus");
  const countOutput = document.querySelector(".quantity-controls output");
  const dateInput = document.getElementById("date");
  const cards = [...document.querySelectorAll(".service-card")];
  let service = "sofa";
  let count = 1;
  let sending = false;
  const idleButtonText = submitButton.textContent;

  function todayInYerevan() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Yerevan",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const get = type => parts.find(part => part.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function updateDate() { dateInput.min = todayInYerevan(); }

  function selectService(value, scroll = false) {
    if (!services.includes(value)) return;
    service = value;
    form.querySelectorAll('input[name="service"]').forEach(input => {
      input.checked = input.value === service;
      input.closest(".furniture-option").classList.toggle("active", input.checked);
    });
    cards.forEach((card, index) => card.classList.toggle("selected", services[index] === service));
    if (scroll) document.getElementById("booking").scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  function setCount(value) {
    count = Math.max(1, Math.min(10, value));
    countOutput.value = String(count);
    countOutput.textContent = String(count);
    minus.disabled = count <= 1;
    plus.disabled = count >= 10;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function isRealDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function validText(value, min, max) {
    return value.length >= min && value.length <= max && !/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
  }

  function acknowledged(text) {
    if (text.trim() === "OK") return true;
    try {
      const result = JSON.parse(text);
      return Boolean(result && (result.ok === true || result.success === true ||
        result.status === "success" || result.result === "success"));
    } catch { return false; }
  }

  function validEndpoint(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "script.google.com" &&
        /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) && !url.username && !url.password;
    } catch { return false; }
  }

  cards.forEach((card, index) => {
    card.querySelector(".service-choice").addEventListener("click", () => selectService(services[index], true));
  });
  form.querySelectorAll('input[name="service"]').forEach(input => {
    input.addEventListener("change", () => selectService(input.value));
  });
  minus.addEventListener("click", () => setCount(count - 1));
  plus.addEventListener("click", () => setCount(count + 1));
  dateInput.addEventListener("focus", updateDate);
  updateDate();
  selectService(service);
  setCount(count);

  const footerYear = document.querySelector(".footer-bottom span:first-child");
  if (footerYear) footerYear.textContent = `© ${new Date().getFullYear()} CasaStar`;

  // Keep FAQ exclusive even in browsers that do not support details[name].
  document.querySelectorAll('.faq-list details').forEach(detail => {
    detail.addEventListener("toggle", () => {
      if (!detail.open) return;
      document.querySelectorAll('.faq-list details').forEach(other => {
        if (other !== detail) other.open = false;
      });
    });
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sending || form.hidden) return;
    errorBox.hidden = true;
    updateDate();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const date = String(data.get("date") || "");
    const notes = String(data.get("notes") || "").trim();
    if (String(data.get("website") || "")) return;

    if (!validText(name, 2, 80) || !/^[+\d\s()\-]+$/.test(phone) ||
      !/^0\d{8}$|^374\d{8}$/.test(phone.replace(/\D/g, ""))) {
      showError("Խնդրում ենք նշել անունը և ճիշտ հայկական հեռախոսահամար (օրինակ՝ 091 000 000)։");
      return;
    }
    if (!validText(notes, 0, 600)) {
      showError("Խնդրում ենք ստուգել լրացուցիչ մանրամասները։");
      return;
    }
    if (date && (!isRealDate(date) || date < todayInYerevan())) {
      showError("Խնդրում ենք ընտրել այսօրվա կամ ավելի ուշ օր։");
      return;
    }
    if (!validEndpoint(GOOGLE_SCRIPT_URL)) {
      showError("Առցանց գրանցումը ժամանակավորապես անհասանելի է։ Խնդրում ենք զանգահարել 091 244 204։");
      return;
    }

    // Same column order and payload contract as the working Apps Script.
    // brand selects CasaStar email subject and sender display name.
    const payload = {
      name: `CasaStar — ${name}`,
      phone,
      car: `CasaStar · ${serviceNames[service]} × ${count}${notes ? ` · ${notes.replace(/\r?\n/g, " ")}` : ""}`,
      carType: "Տան կահույք / CasaStar",
      package: `CasaStar — ${serviceNames[service]} (${count})`,
      price: "Անհատական հաշվարկ / Индивидуальный расчёт",
      date: date || "Կհամաձայնեցնենք զանգով",
      time: "Կհամաձայնեցնենք զանգով",
      brand: "CasaStar",
    };

    sending = true;
    submitButton.disabled = true;
    submitButton.textContent = "Ուղարկվում է…";
    form.setAttribute("aria-busy", "true");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      // text/plain avoids a preflight that Apps Script cannot handle.
      // Read the acknowledgement; do not use an opaque no-cors response.
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok || !acknowledged(await response.text())) throw new Error("Unconfirmed request");
      form.hidden = true;
      successPanel.hidden = false;
      successPanel.querySelector("h3").focus({ preventScroll: true });
    } catch {
      // A delivery may have happened before a network error. Do not auto retry.
      showError("Ուղարկումը չհաջողվեց հաստատել։ Խնդրում ենք զանգահարել 091 244 204՝ հայտը ճշտելու համար։");
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      submitButton.disabled = false;
      submitButton.textContent = idleButtonText;
      form.setAttribute("aria-busy", "false");
    }
  });

  document.getElementById("new-booking").addEventListener("click", () => {
    form.reset();
    errorBox.hidden = true;
    successPanel.hidden = true;
    form.hidden = false;
    selectService(service);
    setCount(count);
    updateDate();
    document.getElementById("name").focus({ preventScroll: true });
  });

  // Allows an agent to prepare the visible form, without submitting it.
  const context = document.modelContext;
  if (context && typeof context.registerTool === "function") {
    const lifecycle = new AbortController();
    try {
      Promise.resolve(context.registerTool({
        name: "stage_cleaning_request",
        title: "Prepare a CasaStar cleaning request",
        description: "Select furniture and quantity in the visible form. Does not send a request or email.",
        inputSchema: {
          type: "object",
          properties: { service: { type: "string", enum: services }, count: { type: "integer", minimum: 1, maximum: 10 } },
          required: ["service"], additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || !services.includes(input.service) ||
            (input.count !== undefined && (!Number.isInteger(input.count) || input.count < 1 || input.count > 10))) {
            throw new Error("Choose valid furniture and quantity from 1 to 10.");
          }
          selectService(input.service, true);
          setCount(input.count === undefined ? 1 : input.count);
          return { prepared: true, service, count, submitted: false };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
      window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
    } catch { /* Booking works without WebMCP support. */ }
  }
})();

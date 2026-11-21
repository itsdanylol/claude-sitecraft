// site.js — the small behaviours: the phone menu, the form's own error, and the steep as you scroll.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // phone menu: links stay visible without JavaScript; with it, they fold behind one button
  const toggle = document.querySelector(".menu-toggle");
  const header = toggle?.closest(".nav");
  if (toggle && header) {
    const set = (open) => { header.classList.toggle("open", open); toggle.setAttribute("aria-expanded", String(open)); toggle.textContent = open ? "Close" : "Menu"; };
    toggle.addEventListener("click", () => set(!header.classList.contains("open")));
    header.querySelectorAll("nav a").forEach((a) => a.addEventListener("click", () => set(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && header.classList.contains("open")) { set(false); toggle.focus(); } });
  }

  // signup: say what is wrong in the page, in the voice of the site, not in a browser bubble
  const form = document.querySelector(".signup");
  if (form) {
    const input = form.querySelector("input[type=email]");
    const error = form.querySelector(".error");
    form.noValidate = true;
    const check = () => {
      const v = input.value.trim();
      const msg = !v ? "Add your shop email, and we will send the first journal page there."
        : !input.checkValidity() ? "That email is missing something. It should look like you@yourshop.co.uk." : "";
      error.textContent = msg; error.hidden = !msg;
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      return !msg;
    };
    form.addEventListener("submit", (e) => { if (!check()) { e.preventDefault(); input.focus(); } });
    input.addEventListener("input", () => { if (input.getAttribute("aria-invalid") === "true") check(); });
  }

  // the steep: each infusion arrives in the last one's color, then deepens into its own
  if (!still && "IntersectionObserver" in window) {
    const steeps = [...document.querySelectorAll(".steep + .steep")];
    steeps.forEach((s) => s.classList.add("unsteeped"));
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.remove("unsteeped"); io.unobserve(en.target); }
    }, { threshold: 0 });
    steeps.forEach((s) => io.observe(s));
  }
})();

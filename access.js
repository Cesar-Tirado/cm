/* =========================================================
   ClipMind AI - Sistema simple de acceso con Supabase
   Supabase Auth para admin + validación de compradores
   ========================================================= */

const SUPABASE_URL = "https://oejzimtxsenruduxlhsq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NfuR2cIUQYnRHUUlBq8hnA_0kaVS08p";

// Ya no usamos ADMIN_PASSWORD.
// El admin ahora se valida con Supabase Auth + tabla admin_clipmind.

// Cambia estos enlaces cuando tengas los archivos finales en tu hosting.
const DOWNLOAD_INSTALLER_URL = "./descargas/ClipMindAI_Setup_v1.0.0.exe";
const DOWNLOAD_MANUAL_URL = "./descargas/Manual_ClipMindAI.pdf";
const SUPPORT_WHATSAPP_URL = "https://wa.me/51999999999";

const TABLE_BUYERS = "compradores_clipmind";
const TABLE_ADMINS = "admin_clipmind";
const STORAGE_VALID_EMAIL_KEY = "clipmind_buyer_email";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "admin") initAdminPage();
  if (page === "installer") initInstallerPage();
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setLoading(button, isLoading, loadingText = "Procesando...") {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function showStatus(element, message, type = "info") {
  if (!element) return;

  element.textContent = message || "";
  element.className = `status-message ${type}`;
}

function formatDate(value) {
  if (!value) return "Sin registro";

  try {
    return new Date(value).toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (_) {
    return value;
  }
}

/* =========================================================
   ADMIN.HTML
   ========================================================= */

function initAdminPage() {
  const lockScreen = document.getElementById("admin-lock");
  const panel = document.getElementById("admin-panel");

  const adminEmailInput = document.getElementById("admin-email");
  const passwordInput = document.getElementById("admin-password");
  const unlockBtn = document.getElementById("unlock-admin-btn");
  const logoutBtn = document.getElementById("admin-logout-btn");
  const lockMessage = document.getElementById("admin-lock-message");

  const buyerForm = document.getElementById("buyer-form");
  const buyerEmailInput = document.getElementById("buyer-email");
  const saveBuyerBtn = document.getElementById("save-buyer-btn");
  const buyerStatus = document.getElementById("buyer-status");
 const buyerMessageBox = document.getElementById("buyer-copy-message");
const sendBuyerEmailBtn = document.getElementById("send-buyer-email-btn");

  const searchForm = document.getElementById("search-form");
  const searchEmailInput = document.getElementById("search-email");
  const searchBtn = document.getElementById("search-buyer-btn");
  const searchStatus = document.getElementById("search-status");
  const buyerResult = document.getElementById("buyer-result");
  const deactivateBtn = document.getElementById("deactivate-buyer-btn");
  const reactivateBtn = document.getElementById("reactivate-buyer-btn");

  let currentSearchedEmail = "";
  let lastRegisteredBuyerEmail = "";

  /*
    Estado inicial obligatorio:
    al cargar admin.html, SOLO se debe ver el login.
  */
  forceShowLogin();

  checkCurrentAdminSession();

  unlockBtn?.addEventListener("click", loginAdmin);

  passwordInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginAdmin();
  });

  adminEmailInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginAdmin();
  });

  logoutBtn?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    forceShowLogin();
    showStatus(lockMessage, "Sesión cerrada.", "info");
  });

  function forceShowLogin() {
    if (panel) {
      panel.hidden = true;
      panel.classList.add("admin-locked");
    }

    if (lockScreen) {
      lockScreen.hidden = false;
      lockScreen.classList.remove("admin-hidden");
    }
  }

  function forceShowPanel() {
    if (lockScreen) {
      lockScreen.hidden = true;
      lockScreen.classList.add("admin-hidden");
    }

    if (panel) {
      panel.hidden = false;
      panel.classList.remove("admin-locked");
    }
  }

  async function checkCurrentAdminSession() {
    try {
      const { data } = await supabaseClient.auth.getSession();

      if (!data.session) {
        forceShowLogin();
        return;
      }

      const isAdmin = await validateCurrentUserIsAdmin();

      if (!isAdmin) {
        await supabaseClient.auth.signOut();
        forceShowLogin();
        showStatus(lockMessage, "Tu usuario no tiene permisos de administrador.", "error");
        return;
      }

      forceShowPanel();
    } catch (error) {
      console.error(error);
      forceShowLogin();
      showStatus(lockMessage, "No se pudo validar la sesión admin.", "error");
    }
  }

  async function loginAdmin() {
    const email = normalizeEmail(adminEmailInput?.value);
    const password = passwordInput?.value || "";

    if (!isValidEmail(email)) {
      showStatus(lockMessage, "Ingresa un correo admin válido.", "error");
      return;
    }

    if (!password) {
      showStatus(lockMessage, "Ingresa tu contraseña admin.", "error");
      return;
    }

    setLoading(unlockBtn, true, "Validando...");

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const isAdmin = await validateCurrentUserIsAdmin();

      if (!isAdmin) {
        await supabaseClient.auth.signOut();
        forceShowLogin();
        showStatus(lockMessage, "Este usuario no está autorizado como admin.", "error");
        return;
      }

      forceShowPanel();
      showStatus(lockMessage, "", "info");
    } catch (error) {
      console.error(error);
      forceShowLogin();
      showStatus(
        lockMessage,
        "No se pudo iniciar sesión. Revisa correo, contraseña o permisos.",
        "error"
      );
    } finally {
      setLoading(unlockBtn, false);
    }
  }

  async function validateCurrentUserIsAdmin() {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !userData.user) {
      return false;
    }

    const { data, error } = await supabaseClient
      .from(TABLE_ADMINS)
      .select("id, activo")
      .eq("user_id", userData.user.id)
      .eq("activo", 1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return false;
    }

    return !!data;
  }

  buyerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = normalizeEmail(buyerEmailInput.value);

    if (buyerMessageBox) buyerMessageBox.value = "";

    if (!isValidEmail(email)) {
      showStatus(buyerStatus, "Ingresa un correo válido.", "error");
      return;
    }

    setLoading(saveBuyerBtn, true, "Guardando comprador...");
    showStatus(buyerStatus, "Guardando comprador en Supabase...", "info");

    try {
      const isAdmin = await validateCurrentUserIsAdmin();

      if (!isAdmin) {
        forceShowLogin();
        showStatus(buyerStatus, "Sesión admin inválida. Vuelve a iniciar sesión.", "error");
        return;
      }

      const payload = {
        email,
        activo: 1,
        origen: "hotmart"
      };

      const { error } = await supabaseClient
        .from(TABLE_BUYERS)
        .upsert(payload, { onConflict: "email" });

      if (error) throw error;

     showStatus(buyerStatus, "Comprador guardado/activado correctamente.", "success");

lastRegisteredBuyerEmail = email;

if (buyerEmailInput) buyerEmailInput.value = "";

if (buyerMessageBox) {
  buyerMessageBox.value = buildBuyerMessage(email);
}
    } catch (error) {
      console.error(error);
      showStatus(
        buyerStatus,
        `Error al guardar: ${error.message || "revisa Supabase/RLS"}`,
        "error"
      );
    } finally {
      setLoading(saveBuyerBtn, false);
    }
  });

sendBuyerEmailBtn?.addEventListener("click", () => {
  const emailTo = normalizeEmail(lastRegisteredBuyerEmail || buyerEmailInput?.value);
  const message = buyerMessageBox?.value?.trim() || "";

  if (!isValidEmail(emailTo)) {
    showStatus(
      buyerStatus,
      "Primero registra un comprador o escribe un correo válido.",
      "error"
    );
    return;
  }

  if (!message) {
    showStatus(
      buyerStatus,
      "Primero genera o escribe el mensaje del correo.",
      "error"
    );
    return;
  }

  const subject = "Acceso a tu descarga de ClipMind AI";

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    const mailtoUrl =
      "mailto:" + encodeURIComponent(emailTo) +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(message);

    window.location.href = mailtoUrl;
  } else {
    const gmailUrl =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      "&to=" + encodeURIComponent(emailTo) +
      "&su=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(message);

    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  }

  showStatus(
    buyerStatus,
    "Se abrió el correo con el mensaje listo para enviar.",
    "success"
  );
});

  searchForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = normalizeEmail(searchEmailInput.value);

    if (!isValidEmail(email)) {
      showStatus(searchStatus, "Ingresa un correo válido para buscar.", "error");
      if (buyerResult) buyerResult.hidden = true;
      return;
    }

    setLoading(searchBtn, true, "Buscando...");
    showStatus(searchStatus, "Buscando comprador...", "info");

    try {
      const isAdmin = await validateCurrentUserIsAdmin();

      if (!isAdmin) {
        forceShowLogin();
        showStatus(searchStatus, "Sesión admin inválida. Vuelve a iniciar sesión.", "error");
        return;
      }

      const buyer = await getBuyerByEmail(email);

      if (!buyer) {
        currentSearchedEmail = "";

        if (buyerResult) buyerResult.hidden = true;

        showStatus(searchStatus, "No existe un comprador registrado con ese correo.", "error");
        return;
      }

      currentSearchedEmail = email;

      renderBuyerResult(buyer);

      if (buyerResult) buyerResult.hidden = false;

      showStatus(searchStatus, "Comprador encontrado.", "success");
    } catch (error) {
      console.error(error);

      if (buyerResult) buyerResult.hidden = true;

      showStatus(
        searchStatus,
        `Error al buscar: ${error.message || "revisa Supabase/RLS"}`,
        "error"
      );
    } finally {
      setLoading(searchBtn, false);
    }
  });

  deactivateBtn?.addEventListener("click", () => updateBuyerActive(currentSearchedEmail, 0));
  reactivateBtn?.addEventListener("click", () => updateBuyerActive(currentSearchedEmail, 1));

  async function updateBuyerActive(email, activo) {
    if (!email) {
      showStatus(searchStatus, "Primero busca un comprador.", "error");
      return;
    }

    const targetBtn = activo === 1 ? reactivateBtn : deactivateBtn;

    setLoading(targetBtn, true, activo === 1 ? "Reactivando..." : "Desactivando...");

    try {
      const isAdmin = await validateCurrentUserIsAdmin();

      if (!isAdmin) {
        forceShowLogin();
        showStatus(searchStatus, "Sesión admin inválida. Vuelve a iniciar sesión.", "error");
        return;
      }

      const { error } = await supabaseClient
        .from(TABLE_BUYERS)
        .update({ activo })
        .eq("email", email);

      if (error) throw error;

      const buyer = await getBuyerByEmail(email);
      renderBuyerResult(buyer);

      showStatus(
        searchStatus,
        activo === 1 ? "Usuario reactivado." : "Usuario desactivado.",
        "success"
      );
    } catch (error) {
      console.error(error);

      showStatus(
        searchStatus,
        `Error al actualizar: ${error.message || "revisa Supabase/RLS"}`,
        "error"
      );
    } finally {
      setLoading(targetBtn, false);
    }
  }

  function renderBuyerResult(buyer) {
    document.getElementById("result-email").textContent = buyer.email;
    document.getElementById("result-active").textContent =
      Number(buyer.activo) === 1 ? "Activo ✅" : "Desactivado ⚠️";
    document.getElementById("result-origin").textContent = buyer.origen || "Sin origen";
    document.getElementById("result-accesses").textContent = buyer.accesos ?? 0;
    document.getElementById("result-created").textContent = formatDate(buyer.fecha_registro);
    document.getElementById("result-last-access").textContent = formatDate(buyer.fecha_ultimo_acceso);
  }
}

function buildBuyerMessage(email) {
  return `Hola 👋

Gracias por comprar ClipMind AI.

Tu correo autorizado es: ${email}

Para descargar el instalador entra aquí:
https://aiclipmind.com/instalador.html

Importante: debes ingresar el mismo correo usado en la compra de Hotmart.

Si tienes problemas con la descarga, escríbenos por soporte.`;
}

async function getBuyerByEmail(email) {
  const { data, error } = await supabaseClient
    .from(TABLE_BUYERS)
    .select("id,email,activo,origen,fecha_registro,fecha_ultimo_acceso,accesos")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;

  return data;
}

/* =========================================================
   INSTALADOR.HTML
   ========================================================= */

function initInstallerPage() {
  const accessForm = document.getElementById("access-form");
  const emailInput = document.getElementById("buyer-access-email");
  const accessBtn = document.getElementById("access-download-btn");
  const accessStatus = document.getElementById("access-status");
  const formCard = document.getElementById("access-form-card");
  const downloadZone = document.getElementById("download-zone");
  const verifiedEmail = document.getElementById("verified-email");
  const logoutBtn = document.getElementById("change-email-btn");

  const installerLink = document.getElementById("installer-download-link");
  const manualLink = document.getElementById("manual-download-link");
  const whatsappLink = document.getElementById("support-whatsapp-link");

  hideDownloadZone();
  lockPrivateLinks();

  const storedEmail = normalizeEmail(localStorage.getItem(STORAGE_VALID_EMAIL_KEY));

  if (storedEmail && emailInput) {
    emailInput.value = storedEmail;
    validateBuyerAccess(storedEmail, { silent: true });
  }

  accessForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = normalizeEmail(emailInput.value);

    if (!isValidEmail(email)) {
      showStatus(accessStatus, "Ingresa un correo válido.", "error");
      hideDownloadZone();
      lockPrivateLinks();
      return;
    }

    await validateBuyerAccess(email, { silent: false });
  });

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_VALID_EMAIL_KEY);

    hideDownloadZone();
    lockPrivateLinks();

    if (formCard) formCard.hidden = false;

    if (emailInput) {
      emailInput.value = "";
      emailInput.focus();
    }

    showStatus(accessStatus, "Puedes ingresar otro correo de compra.", "info");
  });

  async function validateBuyerAccess(email, options = { silent: false }) {
    hideDownloadZone();
    lockPrivateLinks();

    if (!options.silent) {
      setLoading(accessBtn, true, "Verificando compra...");
      showStatus(accessStatus, "Verificando tu compra...", "info");
    }

    try {
      const buyer = await getBuyerByEmail(email);

      if (!buyer) {
        localStorage.removeItem(STORAGE_VALID_EMAIL_KEY);

        hideDownloadZone();
        lockPrivateLinks();

        showStatus(
          accessStatus,
          "No encontramos una compra activa con este correo. Verifica que escribiste el mismo correo usado en Hotmart.",
          "error"
        );

        return;
      }

      if (Number(buyer.activo) !== 1) {
        localStorage.removeItem(STORAGE_VALID_EMAIL_KEY);

        hideDownloadZone();
        lockPrivateLinks();

        showStatus(accessStatus, "Este acceso está desactivado. Contacta a soporte.", "error");

        return;
      }

      localStorage.setItem(STORAGE_VALID_EMAIL_KEY, email);

      unlockPrivateLinks();
      showDownloadZone(email);

      await updateBuyerAccessStats(buyer);
    } catch (error) {
      console.error(error);

      hideDownloadZone();
      lockPrivateLinks();

      showStatus(
        accessStatus,
        `Ocurrió un error al verificar el acceso. ${error.message || "Intenta nuevamente."}`,
        "error"
      );
    } finally {
      if (!options.silent) setLoading(accessBtn, false);
    }
  }

  function hideDownloadZone() {
    if (downloadZone) {
      downloadZone.hidden = true;
      downloadZone.classList.remove("is-visible");
      downloadZone.classList.add("is-hidden");
    }

    if (formCard) {
      formCard.hidden = false;
    }
  }

  function showDownloadZone(email) {
    if (formCard) {
      formCard.hidden = true;
    }

    if (downloadZone) {
      downloadZone.hidden = false;
      downloadZone.classList.remove("is-hidden");
      downloadZone.classList.add("is-visible");
    }

    if (verifiedEmail) {
      verifiedEmail.textContent = email;
    }

    showStatus(accessStatus, "", "info");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function lockPrivateLinks() {
    lockLink(installerLink);
    lockLink(manualLink);
    lockLink(whatsappLink);
  }

  function unlockPrivateLinks() {
    if (installerLink) {
      installerLink.href = DOWNLOAD_INSTALLER_URL;
      installerLink.setAttribute("download", "ClipMindAI_Setup_v1.0.0.exe");
      installerLink.setAttribute("aria-disabled", "false");
      installerLink.classList.remove("is-disabled");
    }

    if (manualLink) {
      manualLink.href = DOWNLOAD_MANUAL_URL;
      manualLink.setAttribute("download", "Manual_ClipMindAI.pdf");
      manualLink.setAttribute("aria-disabled", "false");
      manualLink.classList.remove("is-disabled");
    }

    if (whatsappLink) {
      whatsappLink.href = SUPPORT_WHATSAPP_URL;
      whatsappLink.setAttribute("target", "_blank");
      whatsappLink.setAttribute("rel", "noopener");
      whatsappLink.setAttribute("aria-disabled", "false");
      whatsappLink.classList.remove("is-disabled");
    }
  }

  function lockLink(link) {
    if (!link) return;

    link.href = "#";
    link.removeAttribute("download");
    link.removeAttribute("target");
    link.removeAttribute("rel");
    link.setAttribute("aria-disabled", "true");
    link.classList.add("is-disabled");
  }

  async function updateBuyerAccessStats(buyer) {
    const currentAccesses = Number(buyer.accesos || 0);

    const { error } = await supabaseClient
      .from(TABLE_BUYERS)
      .update({
        fecha_ultimo_acceso: new Date().toISOString(),
        accesos: currentAccesses + 1
      })
      .eq("email", buyer.email);

    if (error) {
      console.warn("No se pudo actualizar fecha_ultimo_acceso/accesos:", error);
    }
  }
}
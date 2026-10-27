```javascript
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // =========================
  // SUPABASE CONFIGURATION
  // =========================

  const cfg = window.TECHNEX_CONFIG || {};

  const ready =
    typeof cfg.SUPABASE_URL === "string" &&
    typeof cfg.SUPABASE_ANON_KEY === "string" &&
    cfg.SUPABASE_URL.startsWith("https://") &&
    !cfg.SUPABASE_URL.includes("/rest/v1") &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
    cfg.SUPABASE_ANON_KEY.length > 20 &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

  const supabaseClient =
    ready && window.supabase
      ? window.supabase.createClient(
          cfg.SUPABASE_URL.replace(/\/+$/, ""),
          cfg.SUPABASE_ANON_KEY
        )
      : null;

  let items = [];
  let filter = "all";
  let channel = null;
  let loadingItems = false;

  // =========================
  // GENERAL HELPERS
  // =========================

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const message = (id, text, error = false) => {
    const element = $(id);
    if (!element) return;

    element.textContent = text;
    element.classList.toggle("error", error);
  };

  const toast = (text) => {
    const element = $("toast");
    if (!element) return;

    element.textContent = text;
    element.classList.add("show");

    setTimeout(() => {
      element.classList.remove("show");
    }, 3500);
  };

  const safeUrl = (raw) => {
    if (!raw) return "";

    try {
      const url = new URL(raw);

      if (!["https:", "http:"].includes(url.protocol)) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  };

  const formatDate = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString();
  };

  // =========================
  // INITIAL PAGE SETUP
  // =========================

  if ($("year")) {
    $("year").textContent = new Date().getFullYear();
  }

  // =========================
  // PUBLIC OFFER CARDS
  // =========================

  function card(item) {
    const url = safeUrl(item.destination_url);

    const typeClass =
      item.type === "task" ? "pill-task" : "pill-offer";

    const typeLabel =
      item.type === "task" ? "TASK" : "OFFER";

    return `
      <article class="offer-card">
        <div class="card-top">
          <span class="pill ${typeClass}">
            ${typeLabel}
          </span>

          <span class="card-date">
            ${esc(formatDate(item.created_at))}
          </span>
        </div>

        <h3>${esc(item.title)}</h3>

        <p>${esc(item.description)}</p>

        <div class="card-bottom">
          ${
            item.reward
              ? `<span class="reward">✦ ${esc(item.reward)}</span>`
              : "<span></span>"
          }

          ${
            url
              ? `<a
                   class="text-link"
                   href="${esc(url)}"
                   target="_blank"
                   rel="noopener noreferrer"
                 >${esc(item.button_label || "View details")} ↗</a>`
              : ""
          }
        </div>
      </article>
    `;
  }

  function render() {
    if (!$("offerGrid")) return;

    const searchText = $("searchInput")
      ? $("searchInput").value.trim().toLowerCase()
      : "";

    const shown = items.filter((item) => {
      const matchesFilter =
        filter === "all" || item.type === filter;

      const searchableText = [
        item.title,
        item.description,
        item.reward || ""
      ].join(" ").toLowerCase();

      return matchesFilter &&
        searchableText.includes(searchText);
    });

    if ($("offerCount")) {
      $("offerCount").textContent = items.length;
    }

    $("offerGrid").innerHTML = shown.map(card).join("");

    if (!$("status")) return;

    if (!supabaseClient) {
      $("status").textContent =
        "Setup error: check config.js, Supabase URL and public key.";
      $("status").classList.remove("hidden");
      return;
    }

    if (shown.length > 0) {
      $("status").textContent =
        `${shown.length} item${shown.length === 1 ? "" : "s"} available`;

      $("status").classList.remove("hidden");
    } else {
      $("status").textContent =
        items.length === 0
          ? "No published tasks or offers yet. Check back soon."
          : "No matching items found.";

      $("status").classList.remove("hidden");
    }
  }

  // =========================
  // LOAD PUBLIC OFFERS
  // =========================

  async function loadItems() {
    if (!supabaseClient) {
      items = [];
      render();
      return;
    }

    if (loadingItems) return;
    loadingItems = true;

    try {
      const { data, error } = await supabaseClient
        .from("offers")
        .select(
          "id,title,description,type,reward,destination_url,button_label,created_at"
        )
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Public offers error:", error);

        if ($("status")) {
          $("status").textContent =
            `Could not load offers: ${error.message}`;

          $("status").classList.remove("hidden");
        }

        return;
      }

      items = data || [];
      render();
    } catch (error) {
      console.error("Unexpected offers error:", error);

      if ($("status")) {
        $("status").textContent =
          "Unable to connect to Supabase. Check your connection and configuration.";

        $("status").classList.remove("hidden");
      }
    } finally {
      loadingItems = false;
    }
  }

  // =========================
  // REALTIME UPDATES
  // =========================

  function subscribeToOffers() {
    if (!supabaseClient) return;

    channel = supabaseClient
      .channel("technex-public-offers")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "offers"
        },
        () => {
          loadItems();
        }
      )
      .subscribe((status) => {
        console.log("Offers realtime status:", status);
      });
  }

  // =========================
  // ADMIN MODAL
  // =========================

  async function openModal() {
    if ($("adminModal")) {
      $("adminModal").classList.remove("hidden");
    }

    await refreshAuth();
  }

  function closeModal() {
    if ($("adminModal")) {
      $("adminModal").classList.add("hidden");
    }
  }

  if ($("adminOpen")) {
    $("adminOpen").addEventListener("click", openModal);
  }

  document.querySelectorAll("[data-close]").forEach((element) => {
    element.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });

  // =========================
  // AUTHENTICATION
  // =========================

  async function refreshAuth() {
    if (!supabaseClient) {
      message(
        "loginMessage",
        "Supabase configuration is missing. Check config.js.",
        true
      );
      return;
    }

    try {
      const { data, error } =
        await supabaseClient.auth.getSession();

      if (error) {
        message("loginMessage", error.message, true);
        return;
      }

      const user = data.session?.user || null;

      // Only the configured admin email can access the dashboard.
      if (
        user &&
        (user.email || "").toLowerCase() !==
          "ayubsammi6@gmail.com"
      ) {
        await supabaseClient.auth.signOut();

        showAdmin(null);

        message(
          "loginMessage",
          "This account is not authorized as the Technex admin.",
          true
        );

        return;
      }

      showAdmin(user);
    } catch (error) {
      console.error("Auth session error:", error);

      message(
        "loginMessage",
        error.message || "Could not check your login session.",
        true
      );
    }
  }

  function showAdmin(user) {
    const isAdmin =
      !!user &&
      (user.email || "").toLowerCase() ===
        "ayubsammi6@gmail.com";

    if ($("loginPane")) {
      $("loginPane").classList.toggle("hidden", isAdmin);
    }

    if ($("dashboardPane")) {
      $("dashboardPane").classList.toggle("hidden", !isAdmin);
    }

    if ($("adminUser")) {
      $("adminUser").textContent =
        isAdmin ? user.email : "";
    }

    if (isAdmin) {
      loadAdminItems();
    }
  }

  if ($("loginForm")) {
    $("loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!supabaseClient) {
        message(
          "loginMessage",
          "Supabase is not configured. Check config.js.",
          true
        );
        return;
      }

      const email = $("adminEmail").value.trim();
      const password = $("adminPassword").value;

      message("loginMessage", "Signing in…");

      const submitButton =
        $("loginForm").querySelector('button[type="submit"]');

      if (submitButton) submitButton.disabled = true;

      try {
        const { data, error } =
          await supabaseClient.auth.signInWithPassword({
            email,
            password
          });

        if (error) {
          message("loginMessage", error.message, true);
          return;
        }

        if (
          (data.user?.email || "").toLowerCase() !==
          "ayubsammi6@gmail.com"
        ) {
          await supabaseClient.auth.signOut();

          showAdmin(null);

          message(
            "loginMessage",
            "Login succeeded, but this email is not authorized as admin.",
            true
          );

          return;
        }

        message("loginMessage", "");
        showAdmin(data.user);
        toast("Admin login successful.");
      } catch (error) {
        console.error("Login error:", error);

        message(
          "loginMessage",
          error.message || "Login request failed.",
          true
        );
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  // =========================
  // LOGOUT
  // =========================

  if ($("logoutBtn")) {
    $("logoutBtn").addEventListener("click", async () => {
      if (!supabaseClient) return;

      try {
        const { error } =
          await supabaseClient.auth.signOut();

        if (error) {
          toast("Logout failed: " + error.message);
          return;
        }

        showAdmin(null);
        resetForm();
        toast("Signed out successfully.");
      } catch (error) {
        toast(error.message || "Logout failed.");
      }
    });
  }

  // =========================
  // ADMIN FORM HELPERS
  // =========================

  function resetForm() {
    if (!$("offerForm")) return;

    $("offerForm").reset();

    if ($("editId")) $("editId").value = "";

    if ($("offerButton")) {
      $("offerButton").value = "View details";
    }

    if ($("saveOffer")) {
      $("saveOffer").textContent = "Publish item";
      $("saveOffer").disabled = false;
    }

    if ($("cancelEdit")) {
      $("cancelEdit").classList.add("hidden");
    }

    message("adminMessage", "");
  }

  if ($("cancelEdit")) {
    $("cancelEdit").addEventListener("click", resetForm);
  }

  // =========================
  // CREATE / UPDATE OFFER
  // =========================

  if ($("offerForm")) {
    $("offerForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!supabaseClient) {
        message(
          "adminMessage",
          "Supabase configuration is missing.",
          true
        );
        return;
      }

      const {
        data: sessionData,
        error: sessionError
      } = await supabaseClient.auth.getSession();

      if (sessionError || !sessionData.session) {
        message(
          "adminMessage",
          "Please sign in to the admin account first.",
          true
        );
        return;
      }

      const email =
        (sessionData.session.user.email || "").toLowerCase();

      if (email !== "ayubsammi6@gmail.com") {
        message(
          "adminMessage",
          "You are not authorized to manage offers.",
          true
        );
        return;
      }

      const editId = $("editId").value;

      const payload = {
        title: $("offerTitle").value.trim(),
        type: $("offerType").value,
        reward: $("offerReward").value.trim() || null,
        description: $("offerDescription").value.trim(),
        destination_url: $("offerUrl").value.trim() || null,
        status: $("offerStatus").value,
        button_label:
          $("offerButton").value.trim() || "View details",
        updated_at: new Date().toISOString()
      };

      if (payload.destination_url &&
          !safeUrl(payload.destination_url)) {
        message(
          "adminMessage",
          "Enter a valid http:// or https:// URL.",
          true
        );
        return;
      }

      if (
        !["task", "offer"].includes(payload.type) ||
        !["published", "draft"].includes(payload.status)
      ) {
        message(
          "adminMessage",
          "Invalid task type or status.",
          true
        );
        return;
      }

      message("adminMessage", "Saving item…");

      if ($("saveOffer")) {
        $("saveOffer").disabled = true;
      }

      try {
        let result;

        if (editId) {
          result = await supabaseClient
            .from("offers")
            .update(payload)
            .eq("id", editId);
        } else {
          result = await supabaseClient
            .from("offers")
            .insert(payload);
        }

        if (result.error) {
          console.error("Save offer error:", result.error);

          message(
            "adminMessage",
            result.error.message,
            true
          );

          return;
        }

        message(
          "adminMessage",
          editId ? "Item updated successfully." :
            "Item created successfully."
        );

        resetForm();

        await loadAdminItems();
        await loadItems();

        toast(editId ? "Item updated." : "Item created.");
      } catch (error) {
        console.error("Save item error:", error);

        message(
          "adminMessage",
          error.message || "Unable to save item.",
          true
        );
      } finally {
        if ($("saveOffer")) {
          $("saveOffer").disabled = false;
        }
      }
    });
  }

  // =========================
  // LOAD ADMIN ITEMS
  // =========================

  async function loadAdminItems() {
    if (!supabaseClient || !$("adminList")) return;

    try {
      const { data, error } = await supabaseClient
        .from("offers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Admin items error:", error);

        $("adminList").innerHTML =
          `<p class="form-message error">${esc(error.message)}</p>`;

        return;
      }

      const rows = data || [];

      $("adminList").innerHTML = rows.map((item) => `
        <div class="admin-item">
          <div>
            <strong>${esc(item.title)}</strong>
            <small>${esc(item.type)} · ${esc(item.status)}</small>
          </div>

          <div class="admin-item-actions">
            <button
              class="mini-btn"
              type="button"
              data-edit="${esc(item.id)}"
            >Edit</button>

            <button
              class="mini-btn danger"
              type="button"
              data-delete="${esc(item.id)}"
            >Delete</button>
          </div>
        </div>
      `).join("") ||
        "<p class='subcopy'>No items yet. Add your first task above.</p>";

      // EDIT BUTTONS
      $("adminList")
        .querySelectorAll("[data-edit]")
        .forEach((button) => {
          button.addEventListener("click", () => {
            const item = rows.find(
              (row) => row.id === button.dataset.edit
            );

            if (!item) return;

            $("editId").value = item.id;
            $("offerTitle").value = item.title;
            $("offerType").value = item.type;
            $("offerReward").value = item.reward || "";
            $("offerDescription").value = item.description;
            $("offerUrl").value = item.destination_url || "";
            $("offerStatus").value = item.status;
            $("offerButton").value =
              item.button_label || "View details";

            $("saveOffer").textContent = "Save changes";
            $("cancelEdit").classList.remove("hidden");

            $("offerForm").scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          });
        });

      // DELETE BUTTONS
      $("adminList")
        .querySelectorAll("[data-delete]")
        .forEach((button) => {
          button.addEventListener("click", async () => {
            const confirmed = confirm(
              "Delete this item permanently?"
            );

            if (!confirmed) return;

            button.disabled = true;

            try {
              const { error } = await supabaseClient
                .from("offers")
                .delete()
                .eq("id", button.dataset.delete);

              if (error) {
                console.error("Delete error:", error);
                toast("Delete failed: " + error.message);
                button.disabled = false;
                return;
              }

              toast("Item deleted successfully.");

              await loadAdminItems();
              await loadItems();
            } catch (error) {
              toast(error.message || "Delete failed.");
              button.disabled = false;
            }
          });
        });
    } catch (error) {
      console.error("Load admin items error:", error);

      $("adminList").innerHTML =
        `<p class="form-message error">${esc(error.message)}</p>`;
    }
  }

  // =========================
  // SEARCH / FILTER / REFRESH
  // =========================

  if ($("refreshBtn")) {
    $("refreshBtn").addEventListener("click", loadItems);
  }

  if ($("searchInput")) {
    $("searchInput").addEventListener("input", render);
  }

  document.querySelectorAll(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;

      document.querySelectorAll(".filter").forEach((other) => {
        other.classList.toggle("active", other === button);
      });

      render();
    });
  });

  // =========================
  // AUTH STATE CHANGES
  // =========================

  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      // Avoid async Supabase calls directly inside this callback.
      setTimeout(() => {
        const user = session?.user || null;

        if (
          user &&
          (user.email || "").toLowerCase() !==
            "ayubsammi6@gmail.com"
        ) {
          supabaseClient.auth.signOut();
          showAdmin(null);
          return;
        }

        showAdmin(user);
      }, 0);
    });
  }

  // =========================
  // START APPLICATION
  // =========================

  if (!supabaseClient) {
    console.error(
      "Technex setup error: check config.js, Supabase URL, and public key."
    );
  }

  loadItems();
  subscribeToOffers();

})();
```

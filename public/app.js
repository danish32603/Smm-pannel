const $ = (id) => document.getElementById(id);

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? {"Content-Type": "application/json"} : {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function show(id, data) {
  $(id).textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function setLoggedIn(loggedIn) {
  $("loginCard").hidden = loggedIn;
  $("dashboard").hidden = !loggedIn;
}

async function checkSession() {
  try {
    const data = await apiRequest("/api/me");
    setLoggedIn(data.loggedIn);
  } catch {
    setLoggedIn(false);
  }
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("loginMsg").textContent = "";
  try {
    await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({password: $("password").value})
    });
    $("password").value = "";
    setLoggedIn(true);
  } catch (error) {
    $("loginMsg").textContent = error.message;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await apiRequest("/api/logout", {method: "POST"});
    setLoggedIn(false);
  } catch (error) {
    alert(error.message);
  }
});

$("balanceBtn").addEventListener("click", async () => {
  show("balanceOutput", "Loading...");
  try { show("balanceOutput", await apiRequest("/api/balance")); }
  catch (error) { show("balanceOutput", error.message); }
});

$("servicesBtn").addEventListener("click", async () => {
  show("servicesOutput", "Loading...");
  try { show("servicesOutput", await apiRequest("/api/services")); }
  catch (error) { show("servicesOutput", error.message); }
});

$("orderForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  show("orderOutput", "Submitting order...");
  try {
    const result = await apiRequest("/api/order", {
      method: "POST",
      body: JSON.stringify({
        service: $("service").value,
        link: $("link").value,
        quantity: $("quantity").value
      })
    });
    show("orderOutput", result);
  } catch (error) {
    show("orderOutput", error.message);
  }
});

$("statusForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  show("statusOutput", "Checking...");
  try {
    show("statusOutput", await apiRequest("/api/order/" + encodeURIComponent($("orderId").value)));
  } catch (error) {
    show("statusOutput", error.message);
  }
});

checkSession();

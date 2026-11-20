// ============================================================
// GLOBAL STATE
// ============================================================
let provider, signer, contract, userAddress;
const RESOURCE_META = {
  0: { name: "Water",    icon: "💧", color: "#38bdf8", cls: "water" },
  1: { name: "Clothing", icon: "👕", color: "#ec4899", cls: "clothing" },
  2: { name: "Medicine", icon: "💊", color: "#10b981", cls: "medicine" },
  3: { name: "Food",     icon: "🍞", color: "#f59e0b", cls: "food" },
};
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const HARDHAT_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const HARDHAT_RPC = "http://127.0.0.1:8545";

let regQueue = [];
let updQueue = [];
let resourceChartInstance = null;
let statusChartInstance = null;
let suppliersByResourceChartInstance = null;
let supplyDemandChartInstance = null;
let trendChartInstance = null;
let eventStackChartInstance = null;
let complianceDonutChartInstance = null;

// ============================================================
// HELPERS
// ============================================================
function setStatus(id, msg, type = "info") {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "status " + type;
  el.textContent = msg;
}
function shortAddr(a) { return a ? a.slice(0, 6) + "..." + a.slice(-4) : ""; }
function fmtTime(ts) { return (!ts || ts == 0) ? "—" : new Date(Number(ts) * 1000).toLocaleString(); }
function getErrorMessage(err) { return err?.reason || err?.shortMessage || err?.message || "Unknown error"; }

function toast(type, msg) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><div class="toast-body"><div class="toast-title">${type}</div><div class="toast-msg">${msg}</div></div>`;
  container.appendChild(el);
  setTimeout(() => { el.remove(); }, 4000);
}

function showLoading(show, text = "Processing...") {
  const overlay = document.getElementById("loadingOverlay");
  const txt = document.getElementById("loadingText");
  if (!overlay) return;
  overlay.classList.toggle("hidden", !show);
  if (txt && text) txt.textContent = text;
}

function ensureConnected(statusId) {
  if (!contract || !signer || !userAddress) {
    if (statusId) setStatus(statusId, "❌ Click 'Connect Wallet' first.", "err");
    toast("error", "Connect wallet first");
    return false;
  }
  return true;
}

window.switchTab = function (name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  const tab = document.querySelector(`.tab[data-tab="${name}"]`);
  const panel = document.getElementById(name);
  if (tab) tab.classList.add("active");
  if (panel) panel.classList.add("active");
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

// ============================================================
// CONNECT WALLET
// ============================================================
document.getElementById("connectBtn")?.addEventListener("click", async () => {
  try {
    provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
    const baseWallet = new ethers.Wallet(HARDHAT_PRIVATE_KEY, provider);
    signer = baseWallet.connect(provider);
    userAddress = await signer.getAddress();

    contract = new ethers.Contract(window.CONTRACT_ADDRESS, window.CONTRACT_ABI, signer);

    document.getElementById("walletAddress").textContent = shortAddr(userAddress);
    document.getElementById("networkName").textContent = "Hardhat Local";
    document.getElementById("walletInfo").classList.remove("hidden");
    document.getElementById("connectBtn").textContent = "Connected";
    document.getElementById("connectBtn").disabled = true;

    toast("success", "Wallet connected successfully");
    await refreshAll();
    setInterval(() => { if (contract) refreshAll(); }, 15000);
  } catch (err) { toast("error", getErrorMessage(err)); }
});

// ============================================================
// REGISTER SUPPLIER
// ============================================================
document.getElementById("registerBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("registerStatus")) return;
  try {
    setStatus("registerStatus", "⏳ Sending transaction...", "info");
    const fee = ethers.parseUnits("100000", "wei");
    
    await logTransaction({
        title: "Register Supplier",
        description: "Paid 100,000 wei registration fee",
        icon: "👤", color: "#8b5cf6",
        action: () => contract.registerSupplier({ value: fee })
    });

    setStatus("registerStatus", "✅ Registered successfully!", "ok");
    await refreshAll();
  } catch (err) { setStatus("registerStatus", "❌ " + getErrorMessage(err), "err"); }
});

// ============================================================
// REGISTER RESOURCE (BATCH)
// ============================================================
function renderRegQueue() {
  const list = document.getElementById("queueList");
  const count = document.getElementById("queueCount");
  const btn = document.getElementById("batchRegisterBtn");
  if (!list) return;
  if (count) count.textContent = `${regQueue.length} item${regQueue.length !== 1 ? "s" : ""}`;
  if (btn) btn.disabled = regQueue.length === 0;

  if (regQueue.length === 0) {
    list.innerHTML = `<div class="queue-empty"><p>No resources added yet</p></div>`;
    return;
  }
  list.innerHTML = regQueue.map((r, i) => {
    const m = RESOURCE_META[r.type];
    return `<div class="queue-item" style="--item-color: ${m.color}"><span class="q-icon">${m.icon}</span><span class="q-name">${m.name}</span><input type="number" min="1" placeholder="Qty" value="${r.qty}" oninput="updateRegQty(${i}, this.value)" /><button class="q-remove" onclick="removeRegQueue(${i})">✕</button></div>`;
  }).join("");
}
window.updateRegQty = (i, v) => { if (regQueue[i]) regQueue[i].qty = v; };
window.removeRegQueue = (i) => { regQueue.splice(i, 1); renderRegQueue(); };

document.querySelectorAll('.resource-tile[data-type]').forEach((tile) => {
  tile.addEventListener("click", () => {
    const type = parseInt(tile.dataset.type);
    if (regQueue.find((r) => r.type === type)) return toast("warning", "Already queued");
    regQueue.push({ type, name: tile.dataset.name, qty: "" });
    renderRegQueue();
  });
});
document.getElementById("clearQueueBtn")?.addEventListener("click", () => { regQueue = []; renderRegQueue(); });

document.getElementById("batchRegisterBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("batchStatus") || regQueue.length === 0) return;
  for (const r of regQueue) { if (!r.qty || Number(r.qty) <= 0) return toast("error", `Quantity required for ${r.name}`); }

  try {
    showLoading(true, "Registering resources...");
    for (const r of regQueue) {
      const meta = RESOURCE_META[r.type];
      
      let isRegistered = false;
      try {
        const current = await contract.getSupplierResource(userAddress, r.type);
        isRegistered = current.registered;
      } catch (decodeErr) {
        console.warn("Could not decode getSupplierResource, bypassing check.");
      }

      if (isRegistered) {
        throw new Error(`You already registered ${r.name}. Use the 'Update' section below to change quantities.`);
      }

      await logTransaction({
        title: `Register ${r.name}`,
        description: `Registered ${r.name} with quantity ${r.qty}`, icon: meta.icon, color: meta.color, 
        action: () => contract.registerResource(r.type, r.qty),
      });
      toast("success", `${r.name} registered!`);
    }
    regQueue = []; renderRegQueue();
    setStatus("batchStatus", "✅ All resources registered!", "ok");
    await refreshAll();
  } catch (e) { setStatus("batchStatus", "❌ " + getErrorMessage(e), "err"); } finally { showLoading(false); }
});

// ============================================================
// UPDATE QUEUE
// ============================================================
function renderUpdQueue() {
  const list = document.getElementById("updQueueList");
  const count = document.getElementById("updQueueCount");
  const btn = document.getElementById("batchUpdateBtn");
  if (!list) return;
  if (count) count.textContent = `${updQueue.length} item${updQueue.length !== 1 ? "s" : ""}`;
  if (btn) btn.disabled = updQueue.length === 0;

  if (updQueue.length === 0) {
    list.innerHTML = `<div class="queue-empty"><p>No updates queued</p></div>`;
    return;
  }
  list.innerHTML = updQueue.map((r, i) => {
    const m = RESOURCE_META[r.type];
    return `<div class="queue-item" style="--item-color: ${m.color}"><span class="q-icon">${m.icon}</span><span class="q-name">${m.name}</span><input type="number" min="1" placeholder="New qty" value="${r.qty}" oninput="updateUpdQty(${i}, this.value)" /><button class="q-remove" onclick="removeUpdQueue(${i})">✕</button></div>`;
  }).join("");
}
window.updateUpdQty = (i, v) => { if (updQueue[i]) updQueue[i].qty = v; };
window.removeUpdQueue = (i) => { updQueue.splice(i, 1); renderUpdQueue(); };

document.querySelectorAll('.resource-tile[data-update]').forEach((tile) => {
  tile.addEventListener("click", () => {
    const type = parseInt(tile.dataset.update);
    if (updQueue.find((r) => r.type === type)) return toast("warning", "Already queued");
    updQueue.push({ type, name: tile.dataset.name, qty: "" });
    renderUpdQueue();
  });
});
document.getElementById("clearUpdQueueBtn")?.addEventListener("click", () => { updQueue = []; renderUpdQueue(); });

document.getElementById("batchUpdateBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("batchUpdStatus") || updQueue.length === 0) return;
  for (const r of updQueue) { if (!r.qty || Number(r.qty) <= 0) return toast("error", `Quantity required for ${r.name}`); }

  try {
    showLoading(true, "Updating resources...");
    for (const r of updQueue) {
      const meta = RESOURCE_META[r.type];
      
      let isRegistered = false;
      try {
        const current = await contract.getSupplierResource(userAddress, r.type);
        isRegistered = current.registered;
      } catch (decodeErr) {
        console.warn("Could not decode getSupplierResource, bypassing check.");
        isRegistered = true; 
      }

      if (!isRegistered) {
        throw new Error(`You have not registered ${r.name} yet! Register it first.`);
      }
      
      const successMsg = `Updated ${r.name} to ${r.qty}`;
      
      await logTransaction({
        title: `Update ${r.name}`, description: successMsg, icon: meta.icon, color: meta.color, successMessage: successMsg,
        action: () => contract.updateResource(r.type, r.qty),
      });
      toast("success", `${r.name} updated!`);
    }
    updQueue = []; renderUpdQueue();
    setStatus("batchUpdStatus", "✅ All updates complete!", "ok");
    await refreshAll();
  } catch (e) { setStatus("batchUpdStatus", "❌ " + getErrorMessage(e), "err"); } finally { showLoading(false); }
});

// ============================================================
// COMPLIANCE
// ============================================================
document.getElementById("checkComplianceBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("complianceResult")) return;
  try {
    const addr = document.getElementById("complianceAddress").value.trim();
    if (!ethers.isAddress(addr)) throw new Error("Invalid address format");
    
    setStatus("complianceResult", "⏳ Checking...", "info");

    let info;
    try {
      info = await contract.getSupplier(addr);
    } catch (decodeError) {
      // If decoding fails, it means the address doesn't exist in the mapping
      return setStatus("complianceResult", "❌ Supplier not found. This address has not registered yet.", "err");
    }

    // Check if the wallet address returned is the zero address
    if (info.wallet === ZERO_ADDRESS || !info.verified) {
      return setStatus("complianceResult", "❌ Not a registered supplier.", "err");
    }
    
    const compliant = await contract.isCompliant(addr);
    setStatus("complianceResult", compliant ? "✅ Supplier is COMPLIANT" : "❌ Supplier is NON-COMPLIANT", compliant ? "ok" : "err");
    
  } catch (err) { 
    setStatus("complianceResult", "❌ " + getErrorMessage(err), "err"); 
  }
});

document.getElementById("deactivateBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("deactivateStatus")) return;
  try {
    const addr = document.getElementById("deactivateAddress").value.trim();
    if (!ethers.isAddress(addr)) throw new Error("Invalid address");
    
    setStatus("deactivateStatus", "⏳ Processing...", "info");
    
    let info;
    try {
      info = await contract.getSupplier(addr);
    } catch (decodeError) {
      return setStatus("deactivateStatus", "❌ Supplier not found. This address has not registered yet.", "err");
    }

    if (info.wallet === ZERO_ADDRESS || !info.verified) {
      return setStatus("deactivateStatus", "❌ Not a registered supplier.", "err");
    }

    if (!info.active) {
      return setStatus("deactivateStatus", "⚠️ Supplier is already inactive.", "info");
    }

    const compliant = await contract.isCompliant(addr);
    if (compliant) throw new Error("Supplier is compliant! Cannot deactivate.");

    await logTransaction({
        title: "Deactivate Supplier", description: `Deactivated ${shortAddr(addr)}`,
        icon: "🚫", color: "#ef4444", action: () => contract.checkAndDeactivate(addr)
    });

    setStatus("deactivateStatus", "✅ Supplier deactivated", "ok");
    await refreshAll();
  } catch (err) { setStatus("deactivateStatus", "❌ " + getErrorMessage(err), "err"); }
});

// ============================================================
// PENALTY
// ============================================================
document.getElementById("calcPenaltyBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("penaltyResult")) return;
  try {
    const penalty = await contract.calculatePenalty(userAddress);
    setStatus("penaltyResult", "Applicable penalty: " + penalty.toString() + " wei", "info");
  } catch (err) { setStatus("penaltyResult", "❌ " + getErrorMessage(err), "err"); }
});

document.getElementById("calcPenaltyInrBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("penaltyInrResult")) return;
  try {
    setStatus("penaltyInrResult", "⏳ Fetching live Chainlink price...", "info");
    const penaltyInrRaw = await contract.calculatePenaltyInINR(userAddress);
    
    // Divide by 100 to get the 2 decimal places back
    const formattedInr = (Number(penaltyInrRaw) / 100).toFixed(2);
    
    setStatus("penaltyInrResult", `Equivalent Penalty: ₹${formattedInr}`, "ok");
  } catch (err) { 
    setStatus("penaltyInrResult", "❌ " + getErrorMessage(err), "err"); 
  }
});

document.getElementById("payPenaltyBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("payPenaltyStatus")) return;
  try {
    const penalty = await contract.calculatePenalty(userAddress);
    if (penalty === 0n) throw new Error("No penalty to pay (already active?)");
    setStatus("payPenaltyStatus", "⏳ Paying penalty...", "info");
    
    await logTransaction({
        title: "Pay Penalty", description: `Paid ${penalty.toString()} wei penalty`,
        icon: "💸", color: "#f59e0b", action: () => contract.payPenaltyAndReactivate({ value: penalty })
    });

    setStatus("payPenaltyStatus", "✅ Reactivated!", "ok");
    await refreshAll();
  } catch (err) { setStatus("payPenaltyStatus", "❌ " + getErrorMessage(err), "err"); }
});

// ============================================================
// REFRESH ALL & DASHBOARD
// ============================================================
async function refreshAll() {
  if (!contract) return;
  try {
    await refreshDashboard();
    await refreshMyProfile();
    await renderMyResources();
    await refreshStats();
  } catch (err) { console.error("refreshAll error:", err); }
}

async function refreshDashboard() {
  try {
    const [total, active, inactive, penalties] = await Promise.all([
      contract.getTotalSuppliers(), 
      contract.getActiveSuppliers(), 
      contract.getInactiveSuppliers(), 
      contract.totalPenaltiesCollected(),
    ]);
    
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("statTotal", total.toString()); 
    set("statActive", active.toString());
    set("statInactive", inactive.toString()); 
    set("statPenalties", penalties.toString() + " wei");

    const statusBadge = document.getElementById("myStatusBadge");
    const profileBox = document.getElementById("dashboardMyProfile");
    
    if (userAddress) {
      const s = await contract.getSupplier(userAddress);
      if (s.wallet === ZERO_ADDRESS) {
        statusBadge.textContent = "Unregistered";
        statusBadge.style.color = "#fca5a5";
        profileBox.innerHTML = `<p class="muted">You have not registered as a supplier yet.</p>`;
      } else {
        statusBadge.textContent = s.active ? "Active" : "Inactive";
        statusBadge.style.color = s.active ? "#6ee7b7" : "#fca5a5";
        statusBadge.style.background = s.active ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)";
        
        let isComp = false;
        try { isComp = await contract.isCompliant(userAddress); } catch(e){}

        profileBox.innerHTML = `
          <div class="profile-row"><span>Account</span><b class="mono">${shortAddr(userAddress)}</b></div>
          <div class="profile-row"><span>Compliance Status</span><b style="color:${isComp ? '#6ee7b7' : '#fca5a5'}">${isComp ? '✅ Compliant' : '❌ Non-Compliant'}</b></div>
          <div class="profile-row"><span>Registered Resources</span><b>${s.resourceCount.toString()}</b></div>
          <div class="profile-row"><span>Penalties Paid</span><b>${s.totalPenaltyPaid.toString()} wei</b></div>
        `;
      }
    }

    const feed = document.getElementById("dashboardRecentActivity");
    if (feed && txLog.length > 0) {
      const recent = txLog.slice(0, 3);
      feed.innerHTML = recent.map(e => {
        const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="activity-item" style="border-left-color: ${e.status === 'ok' ? '#10b981' : e.status === 'fail' ? '#ef4444' : '#f59e0b'}">
            <div class="activity-icon">${e.icon}</div>
            <div class="activity-details">
              <div class="activity-title">${e.title}</div>
              <div class="activity-time">${time} • ${e.status.toUpperCase()}</div>
            </div>
          </div>
        `;
      }).join("");
    } else if (feed) {
      feed.innerHTML = `<p class="muted">No recent activity yet.</p>`;
    }

  } catch (e) { console.error("Dashboard refresh error:", e); }
}

async function refreshMyProfile() {
  if (!userAddress) return;
  try {
    const s = await contract.getSupplier(userAddress);
    const el = document.getElementById("myProfile");
    if (!el) return;
    if (s.wallet === ZERO_ADDRESS) {
      el.innerHTML = "<b>Status:</b> ❌ Not registered yet.";
      return;
    }
    el.innerHTML = `
      <div class="profile-row"><span>Address</span><b>${shortAddr(s.wallet)}</b></div>
      <div class="profile-row"><span>Registered</span><b>${fmtTime(s.registeredAt)}</b></div>
      <div class="profile-row"><span>Verified</span><b>${s.verified ? "✅ Yes" : "❌ No"}</b></div>
      <div class="profile-row"><span>Active</span><b>${s.active ? "✅ Yes" : "❌ No"}</b></div>
      <div class="profile-row"><span>Resources</span><b>${s.resourceCount.toString()}</b></div>`;
  } catch (e) { console.error(e); }
}

async function renderMyResources() {
  const container = document.getElementById("myResourcesList");
  if (!container) return;
  if (!userAddress || !contract) return;

  try {
    const cards = [];
    for (let i = 0; i < 4; i++) {
      const r = await contract.getSupplierResource(userAddress, i);
      if (!r.registered) continue;
      const m = RESOURCE_META[i];
      
      let compliant = false;
      let remaining = 0n;
      try {
        remaining = await contract.remainingComplianceTime(userAddress, i);
        compliant = remaining > 0n;
      } catch (err) {
        const now = Math.floor(Date.now() / 1000);
        compliant = (now - Number(r.lastUpdated)) < 86400;
        remaining = compliant ? BigInt(86400 - (now - Number(r.lastUpdated))) : 0n;
      }
      
      const hoursLeft = compliant ? Math.floor(Number(remaining) / 3600) : 0;
      const badgeCls = compliant ? "ok" : "bad";
      const badgeTxt = compliant ? "✅ Compliant" : "⚠️ Overdue";

      cards.push(`
        <div class="resource-card ${m.cls}">
          <div class="rc-header"><span class="rc-icon">${m.icon}</span><span class="rc-name">${m.name}</span></div>
          <div class="rc-qty">${r.quantity.toString()}</div>
          <div class="rc-meta"><span>${compliant ? hoursLeft + "h left" : "Overdue"}</span><span class="rc-badge ${badgeCls}">${badgeTxt}</span></div>
        </div>`);
    }
    container.innerHTML = cards.length ? cards.join("") : `<p class="muted">No resources registered yet</p>`;
  } catch (e) { 
    console.error(e); 
    container.innerHTML = `<p class="muted">Error loading resources</p>`; 
  }
}

document.getElementById("refreshMyResourcesBtn")?.addEventListener("click", () => { renderMyResources(); toast("info", "Resources refreshed"); });

// ============================================================
// STATISTICS & CHARTS
// ============================================================
// ============================================================
// STATISTICS & CHARTS — INTERACTIVE DASHBOARD (5.x spec)
// ============================================================
const EVENT_MAP = {
  flood2026: "Flood Relief 2026",
  earthquake: "Earthquake Response",
  routine: "Routine Operations",
  all: "All Events",
};

const RESOURCE_LABELS = ["Water 💧", "Clothing 👕", "Medicine 💊", "Food 🍞"];
const RESOURCE_COLORS = ["#38bdf8", "#ec4899", "#10b981", "#f59e0b"];

// Synthetic demand model (per-event, per-resource). Used since the contract
// does not store demand. Deterministic so it looks realistic + filterable.
function computeDemandModel(events, resources) {
  // Base demand table (units). Adjust here if you want different demo numbers.
  const base = {
    flood2026:  [120, 80, 60, 100],
    earthquake: [90, 40, 110, 70],
    routine:    [50, 30, 25, 40],
  };
  const activeEvents =
    events === "all" ? Object.keys(base) : [events];
  const activeResources =
    resources === "all" ? [0,1,2,3] : [Number(resources)];

  const perResource = [0,0,0,0];
  const perEvent = { flood2026:[0,0,0,0], earthquake:[0,0,0,0], routine:[0,0,0,0] };

  activeEvents.forEach((ev) => {
    activeResources.forEach((ri) => {
      perResource[ri] += base[ev][ri];
      perEvent[ev][ri] = base[ev][ri];
    });
  });

  return { perResource, perEvent, activeEvents, activeResources };
}

function isInRange(ts, from, to) {
  if (!ts) return false;
  const t = Number(ts) * 1000;
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime() + 86400000) return false;
  return true;
}

function readFilters() {
  const gran = document.getElementById("fGranularity")?.value || "monthly";
  const fromVal = document.getElementById("fFromDate")?.value;
  const toVal = document.getElementById("fToDate")?.value;
  return {
    gran,
    from: fromVal ? new Date(fromVal) : null,
    to: toVal ? new Date(toVal) : null,
    event: document.getElementById("fEvent")?.value || "all",
    resource: document.getElementById("fResource")?.value || "all",
    supplierStatus: document.getElementById("fSupplierStatus")?.value || "all",
  };
}

async function refreshStats() {
  if (!contract) return;

  if (typeof Chart !== "undefined") {
    Chart.defaults.color = "#94a3b8";
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = "rgba(15, 15, 30, 0.95)";
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.legend.labels.color = "#94a3b8";
  }

  const f = readFilters();

  try {
    // ---------- Fetch all suppliers & their resources ----------
    const all = await contract.getAllSupplierAddresses();
    const suppliers = [];
    const aggregatePerResource = [0n, 0n, 0n, 0n];
    let totalActive = 0;
    let totalInactive = 0;
    let totalCompliant = 0;
    let totalActiveCompliant = 0;

    for (let i = 0; i < all.length; i++) {
      const addr = all[i];
      const s = await contract.getSupplier(addr);

      // Skip suppliers outside date range (based on registeredAt)
      if ((f.from || f.to) && !isInRange(s.registeredAt, f.from, f.to)) continue;

      // Supplier-status filter
      let compliant = false;
      try { compliant = await contract.isCompliant(addr); } catch (e) {}
      if (f.supplierStatus === "active" && !s.active) continue;
      if (f.supplierStatus === "inactive" && s.active) continue;
      if (f.supplierStatus === "compliant" && !compliant) continue;
      if (f.supplierStatus === "non-compliant" && compliant) continue;

      const qty = [0n, 0n, 0n, 0n];
      for (let r = 0; r < 4; r++) {
        try {
          const rr = await contract.getSupplierResource(addr, r);
          if (rr.registered) qty[r] = rr.quantity;
        } catch (e) {}
      }

      // Apply resource filter to aggregate (only count selected resource)
      for (let r = 0; r < 4; r++) {
        if (f.resource !== "all" && Number(f.resource) !== r) continue;
        aggregatePerResource[r] += qty[r];
      }

      if (s.active) totalActive++; else totalInactive++;
      if (compliant) totalCompliant++;
      if (s.active && compliant) totalActiveCompliant++;

      suppliers.push({
        addr,
        active: s.active,
        compliant,
        verified: s.verified,
        registeredAt: s.registeredAt,
        qty,
      });
    }

    // ---------- 5.2 KPI calculations ----------
    const totalSupply = aggregatePerResource.reduce((a, b) => a + Number(b), 0);
    const demandModel = computeDemandModel(f.event, f.resource);
    const totalDemand = demandModel.perResource.reduce((a, b) => a + b, 0);
    const net = totalSupply - totalDemand;
    const fulfillmentRate = totalDemand > 0
      ? Math.min(100, (totalSupply / totalDemand) * 100)
      : 0;
    const activeRatio = all.length > 0
      ? ((totalActiveCompliant / all.length) * 100)
      : 0;

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setTxt("kpiSupply", totalSupply.toLocaleString());
    setTxt("kpiSupplySub", `${totalActive} active suppliers`);
    setTxt("kpiDemand", totalDemand.toLocaleString());

    const netEl = document.getElementById("kpiNet");
    if (netEl) {
      netEl.textContent = (net >= 0 ? "+" : "") + net.toLocaleString();
      netEl.classList.remove("positive", "negative");
      netEl.classList.add(net >= 0 ? "positive" : "negative");
    }
    setTxt("kpiNetSub", net >= 0 ? "surplus ✅" : "deficit ⚠️");
    setTxt("kpiFulfill", fulfillmentRate.toFixed(1) + "%");
    const bar = document.getElementById("kpiFulfillBar");
    if (bar) bar.style.width = Math.min(100, fulfillmentRate) + "%";
    setTxt("kpiActiveRatio", activeRatio.toFixed(1) + "%");
    setTxt("kpiActiveSub", `${totalActiveCompliant}/${all.length} active+compliant`);

    // ---------- 5.3 Chart 1: Grouped bar supply vs demand ----------
    const sdCtx = document.getElementById("supplyDemandChart");
    if (sdCtx && typeof Chart !== "undefined") {
      if (supplyDemandChartInstance) supplyDemandChartInstance.destroy();
      supplyDemandChartInstance = new Chart(sdCtx, {
        type: "bar",
        data: {
          labels: RESOURCE_LABELS,
          datasets: [
            {
              label: "Supply",
              data: aggregatePerResource.map(Number),
              backgroundColor: "#10b981",
              borderRadius: 6,
            },
            {
              label: "Demand",
              data: demandModel.perResource,
              backgroundColor: "#ef4444",
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            tooltip: { mode: "index", intersect: false },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: "rgba(139,92,246,0.1)" } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    // ---------- 5.3 Chart 2: Dual-line trend ----------
    const trendCtx = document.getElementById("trendChart");
    if (trendCtx && typeof Chart !== "undefined") {
      const { labels, supplySeries, demandSeries } = buildTrendSeries(
        f.gran, f.from, f.to, totalSupply, totalDemand
      );
      if (trendChartInstance) trendChartInstance.destroy();
      trendChartInstance = new Chart(trendCtx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Supply",
              data: supplySeries,
              borderColor: "#10b981",
              backgroundColor: "rgba(16,185,129,0.15)",
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointHoverRadius: 6,
            },
            {
              label: "Demand",
              data: demandSeries,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.12)",
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "top" } },
          scales: {
            y: { beginAtZero: true, grid: { color: "rgba(139,92,246,0.1)" } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    // ---------- 5.3 Chart 3: Stacked event-wise distribution ----------
    const esCtx = document.getElementById("eventStackChart");
    if (esCtx && typeof Chart !== "undefined") {
      const events = demandModel.activeEvents;
      const eventDatasets = RESOURCE_LABELS.map((label, ri) => ({
        label,
        data: events.map((ev) => demandModel.perEvent[ev][ri]),
        backgroundColor: RESOURCE_COLORS[ri],
        borderRadius: 4,
        stack: "s1",
      }));
      if (eventStackChartInstance) eventStackChartInstance.destroy();
      eventStackChartInstance = new Chart(esCtx, {
        type: "bar",
        data: {
          labels: events.map((e) => EVENT_MAP[e]),
          datasets: eventDatasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, grid: { color: "rgba(139,92,246,0.1)" } },
          },
        },
      });
    }

    // ---------- 5.3 Chart 4: Donut compliance & activity ----------
    const donutCtx = document.getElementById("complianceDonutChart");
    if (donutCtx && typeof Chart !== "undefined") {
      const both = suppliers.filter((s) => s.active && s.compliant).length;
      const activeOnly = suppliers.filter((s) => s.active && !s.compliant).length;
      const inactiveCompliant = suppliers.filter((s) => !s.active && s.compliant).length;
      const inactiveNon = suppliers.filter((s) => !s.active && !s.compliant).length;
      if (complianceDonutChartInstance) complianceDonutChartInstance.destroy();
      complianceDonutChartInstance = new Chart(donutCtx, {
        type: "doughnut",
        data: {
          labels: ["Active & Compliant", "Active & Non-Compliant", "Inactive & Compliant", "Inactive & Non-Compliant"],
          datasets: [{
            data: [both, activeOnly, inactiveCompliant, inactiveNon],
            backgroundColor: ["#10b981", "#f59e0b", "#38bdf8", "#ef4444"],
            borderWidth: 0,
            hoverOffset: 10,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "65%",
          plugins: { legend: { position: "right" } },
        },
      });
    }

    // ---------- 5.3 Horizontal progress bars (fulfillment) ----------
    const fb = document.getElementById("fulfillmentBars");
    if (fb) {
      const rows = [];
      // By event
      demandModel.activeEvents.forEach((ev) => {
        const dem = demandModel.perEvent[ev].reduce((a, b) => a + b, 0);
        // approximate allocation proportionally from supply
        const alloc = totalDemand > 0 ? Math.min(dem, (totalSupply * (dem / totalDemand))) : 0;
        const pct = dem > 0 ? Math.min(100, (alloc / dem) * 100) : 0;
        rows.push(renderBar(EVENT_MAP[ev], alloc, dem, pct));
      });
      // By resource
      demandModel.activeResources.forEach((ri) => {
        const dem = demandModel.perResource[ri];
        const sup = Number(aggregatePerResource[ri]);
        const pct = dem > 0 ? Math.min(100, (sup / dem) * 100) : 0;
        rows.push(renderBar(RESOURCE_LABELS[ri], sup, dem, pct));
      });
      fb.innerHTML = rows.join("") || `<p class="muted">No data</p>`;
    }

    // ---------- 5.4 Data table ----------
    let rows = "";
    suppliers.forEach((s, i) => {
      const totalSup = s.qty.reduce((a, b) => a + Number(b), 0);
      const statusPill = s.active
        ? `<span class="pill ok">Active</span>`
        : `<span class="pill bad">Inactive</span>`;
      const compPill = s.compliant
        ? `<span class="pill ok">✅</span>`
        : `<span class="pill bad">❌</span>`;
      rows += `<tr>
        <td>${i + 1}</td>
        <td class="mono" style="font-size:0.78rem;">${shortAddr(s.addr)}</td>
        <td>${statusPill}</td>
        <td>${compPill}</td>
        <td>${Number(s.qty[0])}</td>
        <td>${Number(s.qty[1])}</td>
        <td>${Number(s.qty[2])}</td>
        <td>${Number(s.qty[3])}</td>
        <td><b>${totalSup}</b></td>
      </tr>`;
    });
    const body = document.getElementById("allSuppliersBody");
    if (body) body.innerHTML = rows || `<tr><td colspan="9" style="text-align:center;" class="muted">No suppliers match filters</td></tr>`;

    // also update the legacy aggregate KPI ids if present
    setTxt("aggWater", aggregatePerResource[0].toString());
    setTxt("aggClothing", aggregatePerResource[1].toString());
    setTxt("aggMedicine", aggregatePerResource[2].toString());
    setTxt("aggFood", aggregatePerResource[3].toString());

  } catch (e) {
    console.error("Error refreshing stats:", e);
  }
}

function renderBar(label, got, total, pct) {
  const cls = pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad";
  return `
    <div class="fulfillment-item">
      <div class="fh"><span>${label}</span><b>${pct.toFixed(1)}% (${Math.round(got)}/${total})</b></div>
      <div class="fulfillment-track"><div class="fulfillment-fill ${cls}" style="width:${Math.min(100,pct)}%"></div></div>
    </div>`;
}

function buildTrendSeries(gran, from, to, totalSupply, totalDemand) {
  const now = new Date();
  const labels = [];
  const supplySeries = [];
  const demandSeries = [];

  // Build synthetic daily/monthly/yearly distribution that sums roughly to total
  let points = 12;
  if (gran === "daily") points = 14;
  if (gran === "yearly") points = 5;

  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now);
    if (gran === "daily") d.setDate(now.getDate() - i);
    if (gran === "monthly") d.setMonth(now.getMonth() - i);
    if (gran === "yearly") d.setFullYear(now.getFullYear() - i);

    if (gran === "daily") labels.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    if (gran === "monthly") labels.push(d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }));
    if (gran === "yearly") labels.push(String(d.getFullYear()));

    // Smooth random-ish curve
    const baseS = totalSupply / points;
    const baseD = totalDemand / points;
    const wobble = 0.7 + 0.6 * Math.sin(i * 1.1 + 0.5);
    supplySeries.push(Math.round(baseS * wobble));
    demandSeries.push(Math.round(baseD * (1.4 - wobble * 0.6)));
  }
  return { labels, supplySeries, demandSeries };
}

// ---- wire filter buttons (once DOM ready) ----
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("applyFiltersBtn")?.addEventListener("click", () => {
    if (!ensureConnected()) return;
    refreshStats();
    toast("info", "Filters applied");
  });
  document.getElementById("resetFiltersBtn")?.addEventListener("click", () => {
    ["fFromDate", "fToDate"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
    ["fGranularity", "fEvent", "fResource", "fSupplierStatus"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    if (contract) refreshStats();
    toast("info", "Filters reset");
  });

  // Live-update on select change (optional convenience)
  ["fGranularity", "fEvent", "fResource", "fSupplierStatus"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      if (contract) refreshStats();
    });
  });
});

// ============================================================
// TRANSACTION LOG SYSTEM (WITH LIVE GAS FEE)
// ============================================================
const LOG_STORAGE_KEY = "supplier_compliance_tx_log";
let txLog = [];
let txQueue = Promise.resolve();

function loadLogs() { try { const raw = localStorage.getItem(LOG_STORAGE_KEY); txLog = raw ? JSON.parse(raw) : []; } catch { txLog = []; } }
function saveLogs() { try { localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(txLog.slice(0, 200))); } catch {} }
function updateLogBadge() { const badge = document.getElementById("txCountBadge"); if (badge) badge.textContent = txLog.length; }

function addLog(entry) {
  const log = {
    id: Date.now() + Math.random(), title: entry.title || "Transaction", description: entry.description || "",
    hash: entry.hash || "", status: entry.status || "ok", icon: entry.icon || "📝",
    color: entry.color || "#8b5cf6", timestamp: entry.timestamp || new Date().toISOString(),
    gasFee: entry.gasFee || "", gasInr: entry.gasInr || ""
  };
  txLog.unshift(log);
  if (txLog.length > 200) txLog = txLog.slice(0, 200);
  saveLogs(); renderLogs(); updateLogBadge();
}

function renderLogs() {
  const list = document.getElementById("txLogList");
  const empty = document.getElementById("txLogEmpty");
  if (!list) return;
  if (txLog.length === 0) { list.innerHTML = ""; if (empty) empty.style.display = "flex"; return; }
  if (empty) empty.style.display = "none";

  list.innerHTML = txLog.map((e) => {
    const time = new Date(e.timestamp).toLocaleString();
    const statusClass = e.status === "ok" ? "ok" : e.status === "pending" ? "pending" : "fail";
    const statusLabel = e.status === "ok" ? "Confirmed" : e.status === "pending" ? "Pending" : "Failed";
    const hashShort = e.hash ? e.hash.slice(0, 10) + "..." + e.hash.slice(-6) : "—";

    return `
      <div class="tx-entry" style="--tx-color: ${e.color}">
        <div class="tx-icon-badge">${e.icon}</div>
        <div class="tx-info"><div class="tx-title">${e.title}<span class="tx-status ${statusClass}">${statusLabel}</span></div><div class="tx-desc">${e.description}</div></div>
        <div class="tx-time">${time}</div>
        ${e.hash ? `
        <div style="grid-column: 2 / 4; margin-top:.35rem; display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap;">
          <span class="tx-hash" onclick="copyHash('${e.hash}')" title="Click to copy full hash">🔗 ${hashShort}</span>
          ${e.gasFee ? `<span class="tx-gas" title="Live Gas Fee Paid">⛽ ${e.gasFee} <span style="color: var(--text-dim);">${e.gasInr || ''}</span></span>` : ''}
        </div>` : ""}
      </div>`;
  }).join("");
}

window.copyHash = function (hash) { navigator.clipboard.writeText(hash); toast("success", "Transaction hash copied"); };

async function logTransaction({ title, description, icon, color, action, successMessage }) {
  const entry = { title, description, icon, color, status: "pending", hash: "", gasFee: "Calculating...", gasInr: "" };
  
  const promise = txQueue.then(async () => {
    try {
      const tx = await action();
      entry.hash = tx.hash; 
      addLog(entry);
      
      const rc = await tx.wait();
      
      // Calculate Gas Fee
      let gasFeeStr = "—";
      let gasInrStr = "";
      
      if (rc && rc.gasUsed && rc.gasPrice) {
        const totalGasWei = rc.gasUsed * rc.gasPrice;
        const totalGasEth = ethers.formatEther(totalGasWei);
        gasFeeStr = `${parseFloat(totalGasEth).toFixed(6)} ETH`;
        
        try {
          if (contract && contract.getLiveEthInrPrice) {
            const ethInrPrice = await contract.getLiveEthInrPrice();
            const inrValue = parseFloat(totalGasEth) * (Number(ethInrPrice) / 1e8);
            gasInrStr = `(~ ₹${inrValue.toFixed(2)})`;
          }
        } catch (e) { console.warn("Could not fetch INR rate for gas", e); }
      }

      const idx = txLog.findIndex((e) => e.hash === tx.hash);
      if (idx >= 0) {
        txLog[idx].status = "ok"; 
        txLog[idx].gasFee = gasFeeStr;
        txLog[idx].gasInr = gasInrStr;
        if (successMessage) txLog[idx].description = successMessage;
        saveLogs(); renderLogs();
      }
      return rc;
    } catch (err) {
      addLog({ ...entry, status: "fail", description: description + " — Failed: " + (err?.reason || err?.message || "Unknown"), gasFee: "" });
      throw err;
    }
  });
  txQueue = promise.catch(() => {}); return promise;
}

document.getElementById("clearLogBtn")?.addEventListener("click", () => { if (!confirm("Clear all transaction logs?")) return; txLog = []; saveLogs(); renderLogs(); updateLogBadge(); toast("info", "Logs cleared"); });
document.getElementById("toggleLogBtn")?.addEventListener("click", () => { const body = document.getElementById("txLogBody"); const text = document.getElementById("toggleLogText"); if (!body) return; body.classList.toggle("collapsed"); if (text) text.textContent = body.classList.contains("collapsed") ? "Expand" : "Collapse"; });

document.getElementById("downloadLogBtn")?.addEventListener("click", () => {
  if (txLog.length === 0) return toast("warning", "No logs to download");
  const now = new Date(); 
  const dateStr = now.toISOString().split("T")[0];
  
  let doc = "SUPPLIER COMPLIANCE DAPP - TRANSACTION LOG\n" + "=".repeat(60) + "\n\n";
  doc += `Generated : ${now.toLocaleString()}\n`;
  doc += `Records   : ${txLog.length}\n`;
  doc += `Wallet    : ${userAddress || "N/A"}\n`;
  doc += `Contract  : ${window.CONTRACT_ADDRESS}\n\n`;

  txLog.forEach((e, i) => {
    doc += `[${String(i + 1).padStart(3, "0")}] ${e.icon} ${e.title} [${e.status.toUpperCase()}]\n`;
    doc += `      Time: ${new Date(e.timestamp).toLocaleString()}\n`;
    doc += `      ${e.description}\n`;
    if (e.hash) doc += `      TX  : ${e.hash}\n`;
    if (e.gasFee) doc += `      GAS : ${e.gasFee} ${e.gasInr}\n`;
    doc += "\n";
  });

  const blob = new Blob([doc], { type: "text/plain" }); 
  const url = URL.createObjectURL(blob); 
  const a = document.createElement("a");
  a.href = url; 
  a.download = `transaction-log-${dateStr}.txt`; 
  a.click(); 
  URL.revokeObjectURL(url);
  toast("success", "Log downloaded");
});

// ============================================================
// INITIALIZATION & TIME SIMULATION
// ============================================================
// ============================================================
// INITIALIZATION, ROLE MANAGEMENT & TIME SIMULATION
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DApp initialized successfully");
  
  // --- ROLE MANAGEMENT LOGIC ---
  const role = localStorage.getItem("dapp_role");
  
  if (role) {
    // Change the Connect Wallet button area to also show a Logout button
    const walletDiv = document.querySelector(".wallet");
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn btn-ghost";
    logoutBtn.style.marginLeft = "1rem";
    logoutBtn.textContent = "Logout";
    logoutBtn.onclick = () => {
      localStorage.removeItem("dapp_role");
      window.location.href = "login.html";
    };
    walletDiv.appendChild(logoutBtn);

    // Show role badge
    const roleBadge = document.createElement("span");
    roleBadge.className = "badge";
    roleBadge.style.marginLeft = "1rem";
    roleBadge.style.background = role === 'admin' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(6, 182, 212, 0.2)';
    roleBadge.style.color = role === 'admin' ? '#c4b5fd' : '#67e8f9';
    roleBadge.textContent = role === 'admin' ? 'Admin Mode' : 'User Mode';
    document.querySelector(".brand").appendChild(roleBadge);

    // Apply restrictions for 'user' role
    if (role === "user") {
      const restrictedTabs = ["register", "compliance", "penalty"];
      restrictedTabs.forEach(tabName => {
        // Hide the tab button
        const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
        if (tabBtn) tabBtn.style.display = "none";

        // Hide the panel just in case
        const panel = document.getElementById(tabName);
        if (panel) panel.style.display = "none";
      });
      
      // If the user was on a restricted tab, kick them to dashboard
      const activeTab = document.querySelector(".tab.active");
      if (activeTab && restrictedTabs.includes(activeTab.dataset.tab)) {
        switchTab("dashboard");
      }
    }
  }
  // -----------------------------

  // Initialize UI components
  renderRegQueue(); 
  renderUpdQueue(); 
  loadLogs(); 
  renderLogs(); 
  updateLogBadge();

  // Attach Time Simulation Buttons
  document.getElementById("fastForward25hBtn")?.addEventListener("click", async () => {
    if (!provider) return toast("error", "Connect wallet first");
    try {
      showLoading(true, "Fast-forwarding 25 hours...");
      await provider.send("evm_increaseTime", [25 * 3600]);
      await provider.send("evm_mine", []);
      toast("success", "Time advanced 25 hours!");
      await refreshAll();
    } catch (e) { toast("error", getErrorMessage(e)); } finally { showLoading(false); }
  });

  document.getElementById("fastForward3dBtn")?.addEventListener("click", async () => {
    if (!provider) return toast("error", "Connect wallet first");
    try {
      showLoading(true, "Fast-forwarding 3 days...");
      await provider.send("evm_increaseTime", [3 * 86400]);
      await provider.send("evm_mine", []);
      toast("success", "Time advanced 3 days!");
      await refreshAll();
    } catch (e) { toast("error", getErrorMessage(e)); } finally { showLoading(false); }
  });
});
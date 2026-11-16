// ============================================================
// GLOBAL STATE
// ============================================================
let provider, signer, contract, userAddress;
const RESOURCE_NAMES = ["Water", "Clothing", "Medicine", "Food"];
const RESOURCE_META = {
  0: { name: "Water",    icon: "💧", color: "#38bdf8", cls: "water" },
  1: { name: "Clothing", icon: "👕", color: "#ec4899", cls: "clothing" },
  2: { name: "Medicine", icon: "💊", color: "#10b981", cls: "medicine" },
  3: { name: "Food",     icon: "🍞", color: "#f59e0b", cls: "food" },
};
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Hardhat test account #0 (public test key — safe to use locally)
const HARDHAT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const HARDHAT_RPC = "http://127.0.0.1:8545";

let regQueue = [];
let updQueue = [];

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
function getErrorMessage(err) {
  return err?.reason || err?.shortMessage || err?.info?.error?.message || err?.data?.message || err?.message || "Unknown error";
}

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
    if (statusId) setStatus(statusId, "❌ Click 'Connect Wallet' first (top-right).", "err");
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

// ============================================================
// TAB SWITCHING
// ============================================================
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

// ============================================================
// CONNECT WALLET
// ============================================================
document.getElementById("connectBtn")?.addEventListener("click", async () => {
  try {
    if (!window.CONTRACT_ADDRESS || !window.CONTRACT_ABI) {
      toast("error", "contract-info.js missing or invalid.");
      return;
    }

    provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
    signer = new ethers.Wallet(HARDHAT_PRIVATE_KEY, provider);
    userAddress = await signer.getAddress();

    contract = new ethers.Contract(window.CONTRACT_ADDRESS, window.CONTRACT_ABI, signer);

    document.getElementById("walletAddress").textContent = shortAddr(userAddress);
    document.getElementById("networkName").textContent = "Hardhat Local";
    document.getElementById("walletInfo").classList.remove("hidden");
    document.getElementById("connectBtn").textContent = "Connected (Hardhat)";
    document.getElementById("connectBtn").disabled = true;

    toast("success", "Wallet connected successfully");
    await refreshAll();

    setInterval(() => { if (contract) refreshAll(); }, 15000);
  } catch (err) {
    console.error(err);
    toast("error", "Connection failed: " + getErrorMessage(err));
  }
});

// ============================================================
// BATCH REGISTRATION QUEUE
// ============================================================
function renderRegQueue() {
  const list = document.getElementById("queueList");
  const count = document.getElementById("queueCount");
  const btn = document.getElementById("batchRegisterBtn");
  if (!list) return;

  if (count) count.textContent = `${regQueue.length} items`;
  if (btn) btn.disabled = regQueue.length === 0;

  if (regQueue.length === 0) {
    list.innerHTML = `<div class="queue-empty"><p>No resources added yet</p><small>Click the resource tiles above</small></div>`;
    return;
  }

  list.innerHTML = regQueue.map((r, i) => {
    const m = RESOURCE_META[r.type];
    return `<div class="queue-item" style="--item-color: ${m.color}">
      <span class="q-icon">${m.icon}</span><span class="q-name">${m.name}</span>
      <input type="number" min="1" placeholder="Qty" value="${r.qty}" oninput="updateRegQty(${i}, this.value)" />
      <button class="q-remove" onclick="removeRegQueue(${i})">✕</button></div>`;
  }).join("");
}

window.updateRegQty = (i, v) => { if (regQueue[i]) regQueue[i].qty = v; };
window.removeRegQueue = (i) => { regQueue.splice(i, 1); renderRegQueue(); };

document.querySelectorAll('.resource-tile[data-type]').forEach((tile) => {
  tile.addEventListener("click", () => {
    const type = parseInt(tile.dataset.type);
    if (regQueue.find((r) => r.type === type)) return toast("warning", "Already in queue");
    regQueue.push({ type, name: tile.dataset.name, qty: "" });
    renderRegQueue();
  });
});

document.getElementById("clearQueueBtn")?.addEventListener("click", () => { regQueue = []; renderRegQueue(); });

document.getElementById("batchRegisterBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("batchStatus")) return;
  if (regQueue.length === 0) return toast("warning", "Add at least one resource");

  try {
    showLoading(true, "Registering resources...");
    for (const r of regQueue) {
      if (!r.qty || Number(r.qty) <= 0) throw new Error(`Quantity required for ${r.name}`);
      const meta = RESOURCE_META[r.type];
      
      // Updated: contract.registerResource(type, qty)
      await logTransaction({
        title: `Register ${r.name}`,
        description: `Registered ${r.name} with quantity ${r.qty}`,
        icon: meta.icon, color: meta.color,
        action: () => contract.registerResource(r.type, r.qty),
      });
      await new Promise((res) => setTimeout(res, 200)); // Prevent nonce issues
    }
    regQueue = []; renderRegQueue();
    setStatus("batchStatus", "✅ All resources registered!", "ok");
    await refreshAll();
  } catch (e) {
    setStatus("batchStatus", "❌ " + getErrorMessage(e), "err");
  } finally {
    showLoading(false);
  }
});

// ============================================================
// BATCH UPDATE QUEUE
// ============================================================
function renderUpdQueue() {
  const list = document.getElementById("updQueueList");
  const count = document.getElementById("updQueueCount");
  const btn = document.getElementById("batchUpdateBtn");
  if (!list) return;

  if (count) count.textContent = `${updQueue.length} items`;
  if (btn) btn.disabled = updQueue.length === 0;

  if (updQueue.length === 0) {
    list.innerHTML = `<div class="queue-empty"><p>No updates queued</p></div>`;
    return;
  }

  list.innerHTML = updQueue.map((r, i) => {
    const m = RESOURCE_META[r.type];
    return `<div class="queue-item" style="--item-color: ${m.color}">
      <span class="q-icon">${m.icon}</span><span class="q-name">${m.name}</span>
      <input type="number" min="1" placeholder="New qty" value="${r.qty}" oninput="updateUpdQty(${i}, this.value)" />
      <button class="q-remove" onclick="removeUpdQueue(${i})">✕</button></div>`;
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
  if (!ensureConnected("batchUpdStatus")) return;
  if (updQueue.length === 0) return toast("warning", "Add at least one resource");

  try {
    showLoading(true, "Updating resources...");
    for (const r of updQueue) {
      if (!r.qty || Number(r.qty) <= 0) throw new Error(`Quantity required for ${r.name}`);
      const meta = RESOURCE_META[r.type];

      await logTransaction({
        title: `Update ${r.name}`,
        description: `Changed ${r.name} quantity to ${r.qty}`,
        icon: meta.icon, color: meta.color,
        action: () => contract.updateResource(r.type, r.qty),
      });
      await new Promise((res) => setTimeout(res, 200));
    }
    updQueue = []; renderUpdQueue();
    setStatus("batchUpdStatus", "✅ All updates complete!", "ok");
    await refreshAll();
  } catch (e) {
    setStatus("batchUpdStatus", "❌ " + getErrorMessage(e), "err");
  } finally {
    showLoading(false);
  }
});

// ============================================================
// REGISTER SUPPLIER
// ============================================================
document.getElementById("registerBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("registerStatus")) return;

  try {
    setStatus("registerStatus", "⏳ Sending transaction...", "info");
    const fee = ethers.parseUnits("100000", "wei");
    
    // Contract requires a string name parameter
    const tx = await contract.registerSupplier("Supplier", { value: fee });

    setStatus("registerStatus", "⏳ Waiting for confirmation: " + tx.hash, "info");
    await tx.wait();

    setStatus("registerStatus", "✅ Registered successfully!", "ok");
    await refreshAll();
  } catch (err) {
    setStatus("registerStatus", "❌ " + getErrorMessage(err), "err");
  }
});

// ============================================================
// COMPLIANCE CHECK
// ============================================================
document.getElementById("checkComplianceBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("complianceResult")) return;
  try {
    const addr = document.getElementById("complianceAddress").value.trim();
    if (!ethers.isAddress(addr)) throw new Error("Invalid address");
    const compliant = await contract.isCompliant(addr);
    setStatus("complianceResult", compliant ? "✅ Supplier is COMPLIANT" : "❌ Supplier is NON-COMPLIANT", compliant ? "ok" : "err");
  } catch (err) { setStatus("complianceResult", "❌ " + getErrorMessage(err), "err"); }
});

// ============================================================
// DEACTIVATION
// ============================================================
document.getElementById("deactivateBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("deactivateStatus")) return;
  try {
    const addr = document.getElementById("deactivateAddress").value.trim();
    if (!ethers.isAddress(addr)) throw new Error("Invalid address");
    setStatus("deactivateStatus", "⏳ Processing...", "info");
    const tx = await contract.checkAndDeactivate(addr);
    setStatus("deactivateStatus", "⏳ Waiting...", "info");
    await tx.wait();
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

document.getElementById("payPenaltyBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("payPenaltyStatus")) return;
  try {
    const penalty = await contract.calculatePenalty(userAddress);
    if (penalty === 0n) throw new Error("No penalty to pay");
    const tx = await contract.payPenaltyAndReactivate({ value: penalty });
    setStatus("payPenaltyStatus", "⏳ Waiting...", "info");
    await tx.wait();
    setStatus("payPenaltyStatus", "✅ Reactivated successfully!", "ok");
    await refreshAll();
  } catch (err) { setStatus("payPenaltyStatus", "❌ " + getErrorMessage(err), "err"); }
});

// ============================================================
// REFRESH ALL
// ============================================================
async function refreshAll() {
  if (!contract) return;
  try {
    await refreshDashboard();
    await refreshMyProfile();
    await renderMyResources();
    await refreshStats();
  } catch (err) { console.error(err); }
}

async function refreshDashboard() {
  try {
    const [total, active, inactive, penalties] = await Promise.all([
      contract.getTotalSuppliers(), contract.getActiveSuppliers(),
      contract.getInactiveSuppliers(), contract.totalPenaltiesCollected(),
    ]);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("statTotal", total.toString());
    set("statActive", active.toString());
    set("statInactive", inactive.toString());
    set("statPenalties", penalties.toString() + " wei");
  } catch (e) { console.error(e); }
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
      <div class="profile-row"><span>Verified</span><b>${s.verified ? "✅ Yes" : "❌ No"}</b></div>
      <div class="profile-row"><span>Active</span><b>${s.active ? "✅ Yes" : "❌ No"}</b></div>
      <div class="profile-row"><span>Resources</span><b>${s.resourceCount.toString()}</b></div>`;
  } catch (e) { console.error(e); }
}

async function renderMyResources() {
  const container = document.getElementById("myResourcesList");
  if (!container || !userAddress) return;

  try {
    const cards = [];
    for (let i = 0; i < 4; i++) {
      const r = await contract.getSupplierResource(userAddress, i);
      if (!r.registered) continue;
      const m = RESOURCE_META[i];
      const compliant = r.quantity > 0n; // simplified visual check
      cards.push(`
        <div class="resource-card ${m.cls}">
          <div class="rc-header"><span class="rc-icon">${m.icon}</span><span class="rc-name">${m.name}</span></div>
          <div class="rc-qty">${r.quantity.toString()}</div>
          <div class="rc-meta"><span>Registered</span><span class="rc-badge ${compliant ? 'ok' : 'bad'}">${compliant ? '✅ Active' : '⚠️ Overdue'}</span></div>
        </div>`);
    }
    container.innerHTML = cards.join("") || `<p class="muted">No resources registered yet.</p>`;
  } catch (e) { console.error(e); }
}

document.getElementById("refreshMyResourcesBtn")?.addEventListener("click", () => {
  renderMyResources();
  toast("info", "Resources refreshed");
});

async function refreshStats() {
  try {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const [w, c, m, f] = await Promise.all([
      contract.getAggregateQuantity(0), contract.getAggregateQuantity(1),
      contract.getAggregateQuantity(2), contract.getAggregateQuantity(3),
    ]);
    set("aggWater", w.toString()); set("aggClothing", c.toString());
    set("aggMedicine", m.toString()); set("aggFood", f.toString());
  } catch (e) { console.error(e); }
}

// ============================================================
// TRANSACTION LOG SYSTEM
// ============================================================
const LOG_STORAGE_KEY = "supplier_compliance_tx_log";
let txLog = [];
let txQueue = Promise.resolve();

function loadLogs() {
  try { txLog = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY)) || []; } catch { txLog = []; }
}

function saveLogs() {
  try { localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(txLog.slice(0, 200))); } catch {}
}

function updateLogBadge() {
  const badge = document.getElementById("txCountBadge");
  if (badge) badge.textContent = txLog.length;
}

function addLog(entry) {
  const log = {
    id: Date.now(), title: entry.title, description: entry.description,
    hash: entry.hash, status: entry.status, icon: entry.icon,
    color: entry.color, timestamp: new Date().toISOString(),
  };
  txLog.unshift(log);
  saveLogs(); renderLogs(); updateLogBadge();
}

function renderLogs() {
  const list = document.getElementById("txLogList");
  const empty = document.getElementById("txLogEmpty");
  if (!list) return;

  if (txLog.length === 0) {
    list.innerHTML = ""; if (empty) empty.style.display = "flex"; return;
  }
  if (empty) empty.style.display = "none";

  list.innerHTML = txLog.map((e) => `
    <div class="tx-entry" style="--tx-color: ${e.color}">
      <div class="tx-icon-badge">${e.icon}</div>
      <div class="tx-info"><div class="tx-title">${e.title}</div><div class="tx-desc">${e.description}</div></div>
      <div class="tx-time">${new Date(e.timestamp).toLocaleString()}</div>
      ${e.hash ? `<div style="grid-column: 2 / 4;"><span class="tx-hash">${e.hash.slice(0, 10)}...</span></div>` : ""}
    </div>`).join("");
}

async function logTransaction({ title, description, icon, color, action }) {
  const entry = { title, description, icon, color, status: "pending", hash: "" };
  const promise = txQueue.then(async () => {
    try {
      const tx = await action();
      entry.hash = tx.hash;
      addLog(entry);
      await tx.wait();
      const idx = txLog.findIndex((e) => e.hash === tx.hash);
      if (idx >= 0) { txLog[idx].status = "ok"; saveLogs(); renderLogs(); }
    } catch (err) {
      addLog({ ...entry, status: "fail", description: description + " — Failed: " + getErrorMessage(err) });
      throw err;
    }
  });
  txQueue = promise.catch(() => {});
  return promise;
}

document.getElementById("clearLogBtn")?.addEventListener("click", () => {
  if (!confirm("Clear all logs?")) return;
  txLog = []; saveLogs(); renderLogs(); updateLogBadge();
});

document.getElementById("toggleLogBtn")?.addEventListener("click", () => {
  const body = document.getElementById("txLogBody");
  const text = document.getElementById("toggleLogText");
  if (body) { body.classList.toggle("collapsed"); if (text) text.textContent = body.classList.contains("collapsed") ? "Expand" : "Collapse"; }
});

document.getElementById("downloadLogBtn")?.addEventListener("click", () => {
  if (txLog.length === 0) return toast("warning", "No logs");
  let doc = "TRANSACTION LOG\n" + "=".repeat(50) + "\n\n";
  txLog.forEach((e, i) => {
    doc += `[${i + 1}] ${e.title} (${e.status})\n  Time: ${new Date(e.timestamp).toLocaleString()}\n  ${e.description}\n  Hash: ${e.hash}\n\n`;
  });
  const blob = new Blob([doc], { type: "text/plain" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "transaction-log.txt"; a.click();
});

window.addEventListener("DOMContentLoaded", () => {
  renderRegQueue(); renderUpdQueue(); loadLogs(); renderLogs(); updateLogBadge();
});
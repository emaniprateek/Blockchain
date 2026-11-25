// ============================================================
// GLOBAL STATE
// ============================================================
let provider, signer, contract, userAddress;
const RESOURCE_META = {
  // PRIMARY RESOURCES
  0: { name: "Water",    icon: "💧", color: "#38bdf8", cls: "water",    category: "primary",   unit: "Gallons", cost: 0.02 },
  1: { name: "Clothing", icon: "👕", color: "#ec4899", cls: "clothing", category: "primary",   unit: "Pieces",  cost: 0.10 },
  2: { name: "Medicine", icon: "💊", color: "#10b981", cls: "medicine", category: "primary",   unit: "Kits",    cost: 0.50 },
  3: { name: "Food",     icon: "🍞", color: "#f59e0b", cls: "food",     category: "primary",   unit: "Packs",   cost: 0.05 },
  
  // SECONDARY RESOURCES
  4: { name: "Shelter",  icon: "🏠", color: "#8b5cf6", cls: "shelter",  category: "secondary", unit: "Tents",   cost: 2.50 },
  5: { name: "Fuel",     icon: "⛽", color: "#ef4444", cls: "fuel",     category: "secondary", unit: "Liters",  cost: 0.08 },
  6: { name: "Hygiene",  icon: "🧼", color: "#06b6d4", cls: "hygiene",  category: "secondary", unit: "Kits",    cost: 0.30 },
  7: { name: "Power",    icon: "🔋", color: "#facc15", cls: "power",    category: "secondary", unit: "Generators", cost: 5.00 }
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
// ============================================================
// MFA REGISTRATION WIZARD
// ============================================================
let generatedSupplierId = "";
let generatedPasskey = "";
let correctMfaCode = "";

document.getElementById("regNext1Btn")?.addEventListener("click", () => {
  const org = document.getElementById("regOrgName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  
  if (!org || !email.includes("@")) {
    return toast("error", "Please enter a valid organization name and email.");
  }

  const randHex = Math.random().toString(16).slice(2, 6).toUpperCase();
  generatedSupplierId = `SUP-${randHex}`;
  generatedPasskey = `PK-${Math.floor(1000 + Math.random() * 9000)}`;
  correctMfaCode = Math.floor(100000 + Math.random() * 900000).toString();

  document.getElementById("displayRegId").textContent = generatedSupplierId;
  document.getElementById("displayRegPass").textContent = generatedPasskey;
  document.getElementById("mockMfaCode").textContent = correctMfaCode;
  document.getElementById("regMfaInput").value = ""; 

  localStorage.setItem(`supplier_${generatedSupplierId}`, JSON.stringify({ org, email, passkey: generatedPasskey }));

  document.getElementById("regStep1").classList.add("hidden");
  document.getElementById("regStep2").classList.remove("hidden");
  toast("info", `MFA Code sent to ${email}`);
});

document.getElementById("regNext2Btn")?.addEventListener("click", () => {
  const enteredCode = document.getElementById("regMfaInput").value.trim();
  if (enteredCode !== correctMfaCode) {
    return toast("error", "Invalid MFA Code. Please check and try again.");
  }
  document.getElementById("regStep2").classList.add("hidden");
  document.getElementById("regStep3").classList.remove("hidden");
});

document.getElementById("regBack1Btn")?.addEventListener("click", () => {
  document.getElementById("regStep2").classList.add("hidden");
  document.getElementById("regStep1").classList.remove("hidden");
});
document.getElementById("regBack2Btn")?.addEventListener("click", () => {
  document.getElementById("regStep3").classList.add("hidden");
  document.getElementById("regStep2").classList.remove("hidden");
});

document.getElementById("registerBtn")?.addEventListener("click", async () => {
  if (!ensureConnected("registerStatus")) return;
  try {
    setStatus("registerStatus", "⏳ Sending transaction...", "info");
    const fee = ethers.parseUnits("100000", "wei");
    
    await logTransaction({
        title: "Register Supplier",
        description: `Registered as ${generatedSupplierId} (Fee: 100,000 wei)`,
        icon: "👤", color: "#8b5cf6",
        action: () => contract.registerSupplier({ value: fee })
    });

    localStorage.setItem(`wallet_${userAddress}`, generatedSupplierId);

    setStatus("registerStatus", "✅ Registered successfully!", "ok");
    
    setTimeout(() => {
      document.getElementById("regStep3").classList.add("hidden");
      document.getElementById("regStep1").classList.remove("hidden");
      document.getElementById("regOrgName").value = "";
      document.getElementById("regEmail").value = "";
    }, 3000);

    await refreshAll();
  } catch (err) { setStatus("registerStatus", "❌ " + getErrorMessage(err), "err"); }
});

// ============================================================
// REGISTER RESOURCE (BATCH)
// ============================================================
// ============================================================
// REGISTER RESOURCE (BATCH) - UPDATED
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
    const totalCost = (Number(r.qty) * m.cost) || 0;
    
    return `
    <div class="queue-item" style="--item-color: ${m.color}; flex-wrap: wrap;">
      <span class="q-icon">${m.icon}</span>
      <span class="q-name">${m.name} <small style="color: var(--text-dim);">(${m.unit})</small></span>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <input type="number" min="1" placeholder="Qty" value="${r.qty}" oninput="updateRegQty(${i}, this.value)" style="width: 80px;" />
        <span style="font-size: 0.8rem; color: #6ee7b7;">≈ $${totalCost.toFixed(2)}</span>
      </div>
      <button class="q-remove" onclick="removeRegQueue(${i})">✕</button>
    </div>`;
  }).join("");
}
window.updateRegQty = (i, v) => { if (regQueue[i]) { regQueue[i].qty = v; renderRegQueue(); } };
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
    const totalCost = (Number(r.qty) * m.cost) || 0;

    return `
    <div class="queue-item" style="--item-color: ${m.color}; flex-wrap: wrap;">
      <span class="q-icon">${m.icon}</span>
      <span class="q-name">${m.name} <small style="color: var(--text-dim);">(${m.unit})</small></span>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <input type="number" min="1" placeholder="New Qty" value="${r.qty}" oninput="updateUpdQty(${i}, this.value)" style="width: 80px;" />
        <span style="font-size: 0.8rem; color: #6ee7b7;">≈ $${totalCost.toFixed(2)}</span>
      </div>
      <button class="q-remove" onclick="removeUpdQueue(${i})">✕</button>
    </div>`;
  }).join("");
}
window.updateUpdQty = (i, v) => { if (updQueue[i]) { updQueue[i].qty = v; renderUpdQueue(); } };
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

                // Look for this inside refreshDashboard():
        profileBox.innerHTML = `
          <div class="profile-row"><span>Supplier ID</span><b class="mono" style="color:#c4b5fd;">${localStorage.getItem(`wallet_${userAddress}`) || "Not Linked"}</b></div>
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
    // Loop increased to 8 to support the new resources
    for (let i = 0; i < 8; i++) {
      const r = await contract.getSupplierResource(userAddress, i);
      if (!r.registered) continue;
      
      const m = RESOURCE_META[i];
      if (!m) continue; 
      
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
      
      const qtyNum = Number(r.quantity);
      const totalValue = (qtyNum * m.cost).toFixed(2);
      const categoryBadge = m.category === 'primary' 
        ? `<span style="font-size:0.6rem; background:rgba(139,92,246,0.2); color:#c4b5fd; padding:2px 6px; border-radius:4px; margin-left:6px;">PRIMARY</span>`
        : `<span style="font-size:0.6rem; background:rgba(239,68,68,0.2); color:#fca5a5; padding:2px 6px; border-radius:4px; margin-left:6px;">SECONDARY</span>`;

      cards.push(`
        <div class="resource-card ${m.cls}">
          <div class="rc-header">
            <span class="rc-icon">${m.icon}</span>
            <span class="rc-name">${m.name} ${categoryBadge}</span>
          </div>
          <div class="rc-qty">${qtyNum.toLocaleString()} <span style="font-size:0.9rem; color:var(--text-muted); font-weight:normal;">${m.unit}</span></div>
          <div style="font-size:0.8rem; color:#6ee7b7; margin-bottom:0.5rem;">Valued at: $${totalValue}</div>
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

const RESOURCE_LABELS = ["Water 💧", "Clothing 👕", "Medicine 💊", "Food 🍞", "Shelter 🏠", "Fuel ⛽", "Hygiene 🧼", "Power 🔋"];
const RESOURCE_COLORS = ["#38bdf8", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#facc15"];
// Synthetic demand model (per-event, per-resource). Used since the contract
// does not store demand. Deterministic so it looks realistic + filterable.
function computeDemandModel(events, resources) {
  const base = {
    flood2026:  [120, 80, 60, 100, 40, 50, 30, 20],
    earthquake: [90, 40, 110, 70, 80, 60, 50, 30],
    routine:    [50, 30, 25, 40, 20, 30, 15, 10],
  };
  const activeEvents = events === "all" ? Object.keys(base) : [events];
  const activeResources = resources === "all" ? [0,1,2,3,4,5,6,7] : [Number(resources)];

  const perResource = [0,0,0,0,0,0,0,0];
  const perEvent = { 
    flood2026: [0,0,0,0,0,0,0,0], 
    earthquake: [0,0,0,0,0,0,0,0], 
    routine: [0,0,0,0,0,0,0,0] 
  };

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
    const all = await contract.getAllSupplierAddresses();
    const suppliers = [];
    
    // FIX 1: Expanded aggregate array to 8 items
    const aggregatePerResource = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    
    let totalActive = 0;
    let totalInactive = 0;
    let totalCompliant = 0;
    let totalActiveCompliant = 0;

    for (let i = 0; i < all.length; i++) {
      const addr = all[i];
      const s = await contract.getSupplier(addr);

      if ((f.from || f.to) && !isInRange(s.registeredAt, f.from, f.to)) continue;

      let compliant = false;
      try { compliant = await contract.isCompliant(addr); } catch (e) {}
      if (f.supplierStatus === "active" && !s.active) continue;
      if (f.supplierStatus === "inactive" && s.active) continue;
      if (f.supplierStatus === "compliant" && !compliant) continue;
      if (f.supplierStatus === "non-compliant" && compliant) continue;

      // FIX 2: Expanded qty array to 8 items
      const qty = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
      
      // FIX 3: Loop through 8 resources instead of 4
      for (let r = 0; r < 8; r++) {
        try {
          const rr = await contract.getSupplierResource(addr, r);
          if (rr.registered) qty[r] = rr.quantity;
        } catch (e) {}
      }

      // FIX 4: Loop through 8 resources here too
      for (let r = 0; r < 8; r++) {
        if (f.resource !== "all" && Number(f.resource) !== r) continue;
        aggregatePerResource[r] += qty[r];
      }

      if (s.active) totalActive++; else totalInactive++;
      if (compliant) totalCompliant++;
      if (s.active && compliant) totalActiveCompliant++;

      suppliers.push({
        addr, active: s.active, compliant, verified: s.verified, registeredAt: s.registeredAt, qty,
      });
    }

    const totalSupply = aggregatePerResource.reduce((a, b) => a + Number(b), 0);
    const demandModel = computeDemandModel(f.event, f.resource);
    const totalDemand = demandModel.perResource.reduce((a, b) => a + b, 0);
    const net = totalSupply - totalDemand;
    const fulfillmentRate = totalDemand > 0 ? Math.min(100, (totalSupply / totalDemand) * 100) : 0;
    const activeRatio = all.length > 0 ? ((totalActiveCompliant / all.length) * 100) : 0;

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

    // Chart 1
    const sdCtx = document.getElementById("supplyDemandChart");
    if (sdCtx && typeof Chart !== "undefined") {
      if (supplyDemandChartInstance) supplyDemandChartInstance.destroy();
      supplyDemandChartInstance = new Chart(sdCtx, {
        type: "bar",
        data: {
          labels: RESOURCE_LABELS,
          datasets: [
            { label: "Supply", data: aggregatePerResource.map(Number), backgroundColor: "#10b981", borderRadius: 6 },
            { label: "Demand", data: demandModel.perResource, backgroundColor: "#ef4444", borderRadius: 6 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" }, tooltip: { mode: "index", intersect: false } }, scales: { y: { beginAtZero: true, grid: { color: "rgba(139,92,246,0.1)" } }, x: { grid: { display: false } } } },
      });
    }

    // Chart 2
    const trendCtx = document.getElementById("trendChart");
    if (trendCtx && typeof Chart !== "undefined") {
      const { labels, supplySeries, demandSeries } = buildTrendSeries(f.gran, f.from, f.to, totalSupply, totalDemand);
      if (trendChartInstance) trendChartInstance.destroy();
      trendChartInstance = new Chart(trendCtx, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Supply", data: supplySeries, borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.15)", fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 6 },
            { label: "Demand", data: demandSeries, borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.12)", fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 6 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true, grid: { color: "rgba(139,92,246,0.1)" } }, x: { grid: { display: false } } } },
      });
    }

    // Chart 3
    const esCtx = document.getElementById("eventStackChart");
    if (esCtx && typeof Chart !== "undefined") {
      const events = demandModel.activeEvents;
      const eventDatasets = RESOURCE_LABELS.map((label, ri) => ({
        label, data: events.map((ev) => demandModel.perEvent[ev][ri]), backgroundColor: RESOURCE_COLORS[ri], borderRadius: 4, stack: "s1",
      }));
      if (eventStackChartInstance) eventStackChartInstance.destroy();
      eventStackChartInstance = new Chart(esCtx, {
        type: "bar",
        data: { labels: events.map((e) => EVENT_MAP[e]), datasets: eventDatasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { color: "rgba(139,92,246,0.1)" } } } },
      });
    }

    // Chart 4
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
          datasets: [{ data: [both, activeOnly, inactiveCompliant, inactiveNon], backgroundColor: ["#10b981", "#f59e0b", "#38bdf8", "#ef4444"], borderWidth: 0, hoverOffset: 10 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { position: "right" } } },
      });
    }

    // Bars
    const fb = document.getElementById("fulfillmentBars");
    if (fb) {
      const rows = [];
      demandModel.activeEvents.forEach((ev) => {
        const dem = demandModel.perEvent[ev].reduce((a, b) => a + b, 0);
        const alloc = totalDemand > 0 ? Math.min(dem, (totalSupply * (dem / totalDemand))) : 0;
        const pct = dem > 0 ? Math.min(100, (alloc / dem) * 100) : 0;
        rows.push(renderBar(EVENT_MAP[ev], alloc, dem, pct));
      });
      demandModel.activeResources.forEach((ri) => {
        const dem = demandModel.perResource[ri];
        const sup = Number(aggregatePerResource[ri]);
        const pct = dem > 0 ? Math.min(100, (sup / dem) * 100) : 0;
        rows.push(renderBar(RESOURCE_LABELS[ri], sup, dem, pct));
      });
      fb.innerHTML = rows.join("") || `<p class="muted">No data</p>`;
    }

    // Table
    let rows = "";
    suppliers.forEach((s, i) => {
      const totalSup = s.qty.reduce((a, b) => a + Number(b), 0);
      const statusPill = s.active ? `<span class="pill ok">Active</span>` : `<span class="pill bad">Inactive</span>`;
      const compPill = s.compliant ? `<span class="pill ok">✅</span>` : `<span class="pill bad">❌</span>`;
        
      rows += `<tr>
        <td>${i + 1}</td>
        <td class="mono" style="font-size:0.78rem;">${shortAddr(s.addr)}</td>
        <td>${statusPill}</td>
        <td>${compPill}</td>
        <td>${Number(s.qty[0])}</td>
        <td>${Number(s.qty[1])}</td>
        <td>${Number(s.qty[2])}</td>
        <td>${Number(s.qty[3])}</td>
        <td>${Number(s.qty[4])}</td>
        <td>${Number(s.qty[5])}</td>
        <td>${Number(s.qty[6])}</td>
        <td>${Number(s.qty[7])}</td>
        <td><b>${totalSup}</b></td>
      </tr>`;
    });
    
    const body = document.getElementById("allSuppliersBody");
    // FIX 5: Updated colspan to 13
    if (body) body.innerHTML = rows || `<tr><td colspan="13" style="text-align:center;" class="muted">No suppliers match filters</td></tr>`;

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

// ============================================================
// TIMELINE FEATURE (SAFE VERSION)
// ============================================================

const TIMELINE_DATA = {
  earthquake: {
    title: "🌋 Magnitude 6.8 Earthquake — Himalayan Foothills",
    location: "Uttarakhand, India",
    severity: "Critical",
    hours: [
      { h: 0, title: "Seismic Pre-cursors", icon: "📡", action: "Seismographs detect tremors", teams: 0, rescued: 0, resources: 0, story: "At 00:00, the IMD network picks up micro-tremors along the Main Himalayan Thrust. Duty officers log a 2.1 magnitude foreshock. Nothing alarming yet, but the pattern is monitored." },
      { h: 1, title: "The Earth Shakes", icon: "🌋", action: "6.8 magnitude earthquake strikes", teams: 0, rescued: 0, resources: 0, story: "01:17 IST. The ground tears open. Buildings collapse across 14 villages. Power grids fail instantly. The first distress calls come from a single amateur radio operator in Joshimath." },
      { h: 2, title: "Emergency Alert", icon: "🚨", action: "NDRF activated", teams: 0, rescued: 0, resources: 0, story: "The NDRF 8th Battalion base in Ghaziabad scrambles into action. 240 personnel prepare to deploy. States of emergency are drafted for three districts." },
      { h: 3, title: "First Responders Deploy", icon: "🚁", action: "6 rescue teams deployed", teams: 6, rescued: 0, resources: 120, story: "03:45 IST. The first helicopters lift off. Radio contact is re-established. Initial estimate: 1,200 trapped. The race against time has begun." },
      { h: 4, title: "Supply Chains Mobilized", icon: "📦", action: "Water & medicine dispatched", teams: 6, rescued: 0, resources: 480, story: "A convoy leaves Rishikesh with 8,000 water bottles and 3,000 blankets. Blockchain-tracked suppliers automatically flag their inventory for dispatch." },
      { h: 5, title: "First Rescue", icon: "⛑️", action: "12 survivors pulled from debris", teams: 8, rescued: 12, resources: 520, story: "05:30 IST. A thermal drone spots a family under a collapsed school. 12 survivors are pulled out alive. Hope spreads." },
      { h: 6, title: "Field Hospital Set Up", icon: "🏥", action: "Mobile hospital operational", teams: 12, rescued: 28, resources: 760, story: "A 40-bed field hospital is erected. Army medics arrive. The blockchain medical supply chain verifies 2,400 medicine units are in transit." },
      { h: 7, title: "Aftershock Strikes", icon: "⚠️", action: "5.2 magnitude aftershock", teams: 12, rescued: 31, resources: 800, story: "07:11 IST. An aftershock rips through the rescue zone. Teams temporarily pull back. Drone footage reveals new pockets of trapped civilians." },
      { h: 8, title: "Air Bridge Established", icon: "✈️", action: "Continuous helicopter air bridge", teams: 14, rescued: 52, resources: 1050, story: "Land routes are blocked. 14 sorties per hour are established. The on-chain registry now shows 240,000 units of resources committed." },
      { h: 9, title: "Evacuation Ordered", icon: "🚌", action: "1,400 villagers evacuated", teams: 16, rescued: 89, resources: 1240, story: "The district magistrate orders evacuation. 1,400 villagers board 42 buses. Blankets and warm food are distributed in relief camps." },
      { h: 10, title: "Medical Triage Peak", icon: "💊", action: "180 injured treated", teams: 16, rescued: 112, resources: 1480, story: "The field hospital hits peak capacity. 32 critical cases are airlifted. The DApp dashboard shows compliance rate has climbed to 87%." },
      { h: 11, title: "International Aid", icon: "🌐", action: "UN & foreign aid accepted", teams: 18, rescued: 130, resources: 1800, story: "Two C-17 aircraft land with 40 tons of supplies. Cross-border supply chains are now being tracked on-chain with full transparency." },
      { h: 12, title: "Halfway Point", icon: "📍", action: "Situation stabilized", teams: 20, rescued: 148, resources: 2100, story: "148 rescued, 61 confirmed dead. 20 teams are operational. The worst of the immediate crisis has passed, but search and rescue continues." },
      { h: 13, title: "Night Operations", icon: "🔦", action: "Thermal imaging deployed", teams: 20, rescued: 165, resources: 2250, story: "Rescue operations shift to thermal imaging. A 5-year-old boy is found alive under a wooden beam. His rescue is broadcast live." },
      { h: 14, title: "Supply Chain Verified", icon: "🔗", action: "On-chain audit completed", teams: 20, rescued: 178, resources: 2500, story: "A full audit shows 96% of all resources delivered have come from compliant, verified suppliers. Non-compliant suppliers are automatically deactivated." },
      { h: 15, title: "Second Aftershock", icon: "⚠️", action: "4.4 magnitude aftershock", teams: 20, rescued: 181, resources: 2550, story: "A 4.4 magnitude aftershock is felt. Teams are already in reinforced positions. No new collapses. The valley is stabilizing." },
      { h: 16, title: "Rehabilitation Begins", icon: "🏗️", action: "Temporary shelters built", teams: 18, rescued: 190, resources: 2800, story: "2,000 temporary shelters are erected. Families are reunited. The government announces a relief package." },
      { h: 17, title: "Disease Surveillance", icon: "🦠", action: "Epidemic prevention deployed", teams: 18, rescued: 195, resources: 3000, story: "Medical teams fan out to test wells and distribute chlorine tablets. Vaccination for 3,000 children begins." },
      { h: 18, title: "Restoring Connectivity", icon: "📡", action: "Mobile towers restored", teams: 16, rescued: 200, resources: 3150, story: "Engineers restore 6 mobile towers. For the first time in 18 hours, 8,000 people can call their families." },
      { h: 19, title: "Volunteer Surge", icon: "🙋", action: "2,400 volunteers register", teams: 22, rescued: 204, resources: 3300, story: "Doctors, engineers, and drivers register through the portal. Community kitchens open, serving 8,000 hot meals per day." },
      { h: 20, title: "Rescue Complete", icon: "✅", action: "All trapped survivors rescued", teams: 20, rescued: 211, resources: 3400, story: "The NDRF announces all known trapped survivors have been rescued. 211 people saved. The final rescue is a 62-year-old woman." },
      { h: 21, title: "Damage Assessment", icon: "📊", action: "Structural survey begins", teams: 15, rescued: 211, resources: 3500, story: "1,100 homes are classified as destroyed. A satellite-based damage map is uploaded to the blockchain for transparency." },
      { h: 22, title: "Aid Distribution Peak", icon: "🎁", action: "15,000 relief kits distributed", teams: 18, rescued: 211, resources: 3800, story: "Every kit is barcoded and logged on-chain. There is no double-distribution and no corruption." },
      { h: 23, title: "Dawn Breaks", icon: "🌅", action: "Recovery phase formalized", teams: 16, rescued: 211, resources: 3950, story: "The emergency phase is formally over. The final tally: 211 rescued, 8,400 families supported, and zero diversion of aid." }
    ]
  },
  flood: {
    title: "🌊 Catastrophic Flooding — Godavari River Basin",
    location: "Andhra Pradesh, India",
    severity: "Critical",
    hours: [
      { h: 0, title: "Torrential Rain", icon: "🌧️", action: "200mm rainfall in 6 hours", teams: 0, rescued: 0, resources: 0, story: "The IMD records 200mm of rainfall in just 6 hours. Reservoirs are at 92% capacity. The river is rising fast." },
      { h: 1, title: "River Overflows", icon: "🌊", action: "Godavari breaches embankment", teams: 0, rescued: 0, resources: 0, story: "01:30 IST. Water surges through 12 villages. 1,400 homes are flooded. The local police launch rescue boats." },
      { h: 2, title: "State Alert", icon: "🚨", action: "NDRF & SDRF activated", teams: 0, rescued: 0, resources: 0, story: "12 teams of NDRF and 8 teams of SDRF are deployed. The chief minister addresses the state, urging residents to move to higher ground." },
      { h: 3, title: "Mass Rescue Launched", icon: "🚤", action: "24 rescue boats deployed", teams: 8, rescued: 45, resources: 100, story: "The first rescue boats hit the water. By 03:45, 45 people are pulled from rooftops. A 4-year-old is found clinging to a floating door." },
      { h: 4, title: "Emergency Shelters Open", icon: "🏠", action: "18 relief camps established", teams: 10, rescued: 120, resources: 400, story: "18 relief camps are opened. They quickly fill with 4,000 displaced people. Blankets and dry food are distributed." },
      { h: 5, title: "Helicopter Rescue", icon: "🚁", action: "8 airlifted from stranded rooftop", teams: 12, rescued: 165, resources: 480, story: "A family of 8 is spotted on a rooftop. Two Air Force helicopters are dispatched. The rescue takes 40 minutes." },
      { h: 6, title: "Dam Release Warning", icon: "⚠️", action: "Upstream dam releases water", teams: 14, rescued: 210, resources: 600, story: "The upstream dam begins controlled release. Downstream villages have 2 hours to evacuate. Sirens blare across 22 villages." },
      { h: 7, title: "Evacuation Sprint", icon: "🚌", action: "14,000 evacuated in 2 hours", teams: 16, rescued: 280, resources: 700, story: "320 buses are commandeered. By 07:55, 14,000 people are on higher ground. Not a single life is lost in this evacuation." },
      { h: 8, title: "Flood Peak", icon: "🌊", action: "Water level peaks at 14 metres", teams: 16, rescued: 290, resources: 750, story: "The flood peaks at 14 metres above normal. 40% of the city is underwater. But the people are safe." },
      { h: 9, title: "Medical Emergency", icon: "💊", action: "Field hospital set up", teams: 18, rescued: 310, resources: 900, story: "A field hospital is set up at the stadium. They treat 80 patients in the first 2 hours. Medical supply chains are verified." },
      { h: 10, title: "Air-Drop Operations", icon: "📦", action: "5,000 relief kits air-dropped", teams: 18, rescued: 330, resources: 1100, story: "The Air Force begins air-dropping relief kits. Each kit is marked with a QR code linked to the blockchain." },
      { h: 11, title: "Volunteer Mobilization", icon: "🙋", action: "1,800 volunteers deployed", teams: 20, rescued: 350, resources: 1200, story: "1,800 volunteers respond in 2 hours. They are trained and deployed to camps to cook food and distribute supplies." },
      { h: 12, title: "Rescue Statistics", icon: "📍", action: "350 rescued, 1,800 in camps", teams: 22, rescued: 370, resources: 1350, story: "The 12-hour mark. 370 rescued. Water is receding slowly. The worst is over." },
      { h: 13, title: "Disease Prevention", icon: "🦠", action: "Water chlorination begins", teams: 20, rescued: 375, resources: 1450, story: "Teams begin chlorinating 400 wells. 30,000 chlorine tablets are distributed. Health workers educate about hygiene." },
      { h: 14, title: "Bridge Restoration", icon: "🌉", action: "Bailey bridge built in 6 hours", teams: 18, rescued: 378, resources: 1550, story: "Army engineers work to build a Bailey bridge. It opens at 14:30, restoring road access. The city is no longer isolated." },
      { h: 15, title: "Family Reunification", icon: "👨‍👩‍👧", action: "340 families reunited", teams: 16, rescued: 382, resources: 1650, story: "A family reunification centre is set up. 340 families are reunited using the blockchain ID system." },
      { h: 16, title: "Aid Corruption Check", icon: "🔗", action: "On-chain audit: zero diversion", teams: 15, rescued: 385, resources: 1750, story: "A full on-chain audit of all relief materials is conducted. Result: zero diversion. Full transparency is achieved." },
      { h: 17, title: "Receding Water", icon: "📉", action: "Water recedes 2 metres", teams: 14, rescued: 390, resources: 1850, story: "The floodwater has receded 2 metres. 4 villages are accessible. Damage assessment begins." },
      { h: 18, title: "Supply Chain Peak", icon: "📦", action: "25,000 relief kits delivered", teams: 15, rescued: 392, resources: 2000, story: "Cumulative 25,000 relief kits delivered. Every supplier on our blockchain has been audited. The logistics are extraordinary." },
      { h: 19, title: "Aid Coordination", icon: "🤝", action: "UN & NGOs coordinate", teams: 16, rescued: 395, resources: 2150, story: "A shared blockchain dashboard is set up so every organization can see what's needed. Duplication is avoided." },
      { h: 20, title: "Emotional Toll", icon: "❤️", action: "Psychosocial support begins", teams: 18, rescued: 398, resources: 2250, story: "40 counsellors arrive to provide psychosocial first aid. Children draw and play in child-friendly spaces." },
      { h: 21, title: "Restoring Power", icon: "⚡", action: "Power restored in 12 villages", teams: 14, rescued: 400, resources: 2350, story: "Power engineers restore electricity to 12 villages. Streetlights come on for the first time since the flood." },
      { h: 22, title: "Health Check-ups", icon: "🩺", action: "6,000 health screenings", teams: 14, rescued: 400, resources: 2450, story: "Medical teams screen 6,000 people for post-flood diseases. The epidemic has been prevented through early intervention." },
      { h: 23, title: "First Phase Complete", icon: "🌅", action: "Emergency response ends", teams: 12, rescued: 400, resources: 2500, story: "24 hours. 400 rescued. Zero corruption. The emergency phase ends. The blockchain ledger is complete." }
    ]
  },
  tsunami: {
    title: "🌊 Tsunami Warning — Eastern Coast",
    location: "Tamil Nadu & Andhra Coast",
    severity: "Critical",
    hours: Array.from({ length: 24 }, (_, i) => ({
      h: i, title: `Hour ${i} Operations`, icon: "🌊", action: "Tsunami response actions", teams: i * 2, rescued: i * 10, resources: i * 100,
      story: `Hour ${i}: Emergency teams are actively coordinating tsunami relief efforts along the eastern coast. Supplies are being distributed and civilians moved to higher ground.`
    }))
  },
  cyclone: {
    title: "🌀 Severe Cyclone — Odisha Coast",
    location: "Odisha, India",
    severity: "High",
    hours: Array.from({ length: 24 }, (_, i) => ({
      h: i, title: `Hour ${i} Operations`, icon: "🌀", action: "Cyclone response actions", teams: i * 2, rescued: i * 10, resources: i * 100,
      story: `Hour ${i}: Emergency teams are actively coordinating cyclone relief efforts. Supplies are being distributed and civilians moved to shelters.`
    }))
  }
};

let currentScenario = 'earthquake';
let selectedHour = null;
let playInterval = null;

window.renderTimeline = function() {
  const data = TIMELINE_DATA[currentScenario];
  if(!data) return;

  // Update Meta
  const meta = document.getElementById("timelineMeta");
  if(meta) {
    meta.innerHTML = `
      <div style="display:flex; gap:1.5rem; flex-wrap:wrap; margin-top:1rem;">
        <div><span class="muted" style="font-size:0.8rem;">EVENT</span><br><b>${data.title}</b></div>
        <div><span class="muted" style="font-size:0.8rem;">LOCATION</span><br><b>${data.location}</b></div>
        <div><span class="muted" style="font-size:0.8rem;">SEVERITY</span><br><b style="color:#fca5a5;">${data.severity}</b></div>
      </div>
    `;
  }

  // Update Hour Strip
  const strip = document.getElementById("hourStrip");
  if(strip) {
    strip.innerHTML = data.hours.map((h, i) => {
      const isActive = selectedHour === i;
      const cls = h.h === 0 ? 'disaster' : h.h <= 4 ? 'critical' : 'normal';
      return `
        <div class="hour-box ${isActive ? 'active' : ''}" onclick="window.selectHour(${i})">
          <div class="hb-time">${String(h.h).padStart(2, '0')}:00</div>
          <div class="hb-icon">${h.icon}</div>
          <div class="hb-title">${h.title}</div>
        </div>
      `;
    }).join("");
  }

  // Update Summary Stats
  const last = data.hours[23];
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  if(last) {
    set("tlCritical", data.hours.filter(h => h.h <= 4).length);
    set("tlResources", last.resources.toLocaleString());
    set("tlRescued", last.rescued.toLocaleString());
    set("tlTeams", last.teams);
  }
};

window.selectHour = function(index) {
  selectedHour = index;
  const data = TIMELINE_DATA[currentScenario];
  const h = data.hours[index];
  
  // Re-render strip to update active state
  window.renderTimeline();
  
  // Update Detail Card
  const detail = document.getElementById("timelineDetail");
  if(detail) {
    detail.innerHTML = `
      <div class="td-header">
        <span class="td-time">Hour ${String(h.h).padStart(2, '0')}:00</span>
        <span class="td-icon">${h.icon}</span>
        <div class="td-titles">
          <h3>${h.title}</h3>
          <p class="muted">${h.action}</p>
        </div>
      </div>
      <div class="td-stats">
        <div class="td-stat"><span class="muted">Teams</span><b>${h.teams}</b></div>
        <div class="td-stat"><span class="muted">Rescued</span><b>${h.rescued}</b></div>
        <div class="td-stat"><span class="muted">Resources</span><b>${h.resources.toLocaleString()}</b></div>
      </div>
      <div class="td-story">
        <p>${h.story}</p>
      </div>
    `;
  }

  // Update progress bar
  const prog = document.getElementById("timelineProgressFill");
  if(prog) prog.style.width = `${((index + 1) / 24) * 100}%`;
};

// Wire up buttons safely
document.addEventListener("DOMContentLoaded", () => {
  // Scenario Buttons
  document.querySelectorAll(".scenario-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".scenario-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentScenario = e.target.dataset.scenario;
      selectedHour = null;
      window.renderTimeline();
      document.getElementById("timelineDetail").innerHTML = `<div class="empty-timeline"><span style="font-size:2.5rem;">🕐</span><p>Select an hour above to view the action & story</p></div>`;
      document.getElementById("timelineProgressFill").style.width = "0%";
    });
  });

  // Play / Reset
  document.getElementById("playTimelineBtn")?.addEventListener("click", () => {
    if(playInterval) { clearInterval(playInterval); playInterval = null; document.getElementById("playbackStatus").textContent = "Paused"; return; }
    if(selectedHour === null) selectedHour = 0;
    document.getElementById("playbackStatus").textContent = "Playing...";
    playInterval = setInterval(() => {
      selectedHour++;
      if(selectedHour > 23) { clearInterval(playInterval); playInterval = null; document.getElementById("playbackStatus").textContent = "Completed"; return; }
      window.selectHour(selectedHour);
    }, 1500);
  });

  document.getElementById("resetTimelineBtn")?.addEventListener("click", () => {
    if(playInterval) { clearInterval(playInterval); playInterval = null; }
    selectedHour = null;
    document.getElementById("playbackStatus").textContent = "Ready";
    window.renderTimeline();
    document.getElementById("timelineDetail").innerHTML = `<div class="empty-timeline"><span style="font-size:2.5rem;">🕐</span><p>Select an hour above to view the action & story</p></div>`;
    document.getElementById("timelineProgressFill").style.width = "0%";
  });

  // Initial Render
  window.renderTimeline();
});
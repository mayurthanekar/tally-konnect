import { useState, useEffect, useRef, useCallback } from "react";
import api from "./api";

/* --- CONSTANTS --- */
const SYNC_MODULES = [
  { id: "closing_stock", label: "Closing Stock Export", desc: "Tally -> Fynd inventory sync", icon: "P" },
  { id: "sales_order", label: "Sales Order", desc: "Inbound sales order sync", icon: "S" },
  { id: "return_sales_order", label: "Return Sales Order", desc: "Return order processing", icon: "R" },
  { id: "sales_voucher", label: "Sales Voucher", desc: "Sales voucher generation", icon: "V" },
  { id: "return_sales_voucher", label: "Return Sales Voucher", desc: "Credit note / return voucher", icon: "C" },
];

const TALLY_FIELDS = [
  { key: "date", label: "Date", required: true, type: "date" },
  { key: "party_name", label: "Party Name", required: true, type: "string" },
  { key: "item_name", label: "Item Name", required: true, type: "string" },
  { key: "quantity", label: "Quantity", required: true, type: "number" },
  { key: "rate", label: "Rate", required: true, type: "number" },
  { key: "amount", label: "Amount", required: false, type: "number" },
  { key: "discount", label: "Discount", required: false, type: "number" },
  { key: "tax_rate", label: "Tax Rate", required: false, type: "number" },
  { key: "tax_amount", label: "Tax Amount", required: false, type: "number" },
  { key: "cgst", label: "CGST", required: false, type: "number" },
  { key: "sgst", label: "SGST", required: false, type: "number" },
  { key: "igst", label: "IGST", required: false, type: "number" },
  { key: "total_amount", label: "Total Amount", required: false, type: "number" },
  { key: "reference_no", label: "Reference No", required: false, type: "string" },
  { key: "narration", label: "Narration", required: false, type: "string" },
  { key: "godown", label: "Godown", required: false, type: "string" },
  { key: "unit", label: "Unit", required: false, type: "string" },
  { key: "hsn_code", label: "HSN Code", required: false, type: "string" },
  { key: "batch_no", label: "Batch No", required: false, type: "string" },
  { key: "order_no", label: "Order No", required: false, type: "string" },
  { key: "voucher_type", label: "Voucher Type", required: false, type: "string" },
  { key: "buyer_gstin", label: "Buyer GSTIN", required: false, type: "string" },
  { key: "buyer_address", label: "Buyer Address", required: false, type: "string" },
  { key: "buyer_state", label: "Buyer State", required: false, type: "string" },
  { key: "buyer_pincode", label: "Buyer Pincode", required: false, type: "string" },
];

const SCHEDULE_PRESETS = [
  { id: "5min", label: "Every 5 min", cron: "*/5 * * * *" },
  { id: "15min", label: "Every 15 min", cron: "*/15 * * * *" },
  { id: "30min", label: "Every 30 min", cron: "*/30 * * * *" },
  { id: "hourly", label: "Hourly", cron: "0 * * * *" },
  { id: "6hours", label: "Every 6 hrs", cron: "0 */6 * * *" },
  { id: "daily", label: "Daily", cron: "0 0 * * *" },
  { id: "weekly", label: "Weekly", cron: "0 0 * * 0" },
  { id: "custom", label: "Custom", cron: "" },
];

const SAMPLE_MAPPING = [
  { apiField: "order_date", tallyXml: "DATE", tallyField: "date", required: true },
  { apiField: "buyer_name", tallyXml: "PARTYNAME", tallyField: "party_name", required: true },
  { apiField: "sku_name", tallyXml: "STOCKITEMNAME", tallyField: "item_name", required: true },
  { apiField: "qty", tallyXml: "BILLEDQTY", tallyField: "quantity", required: true },
  { apiField: "selling_price", tallyXml: "RATE", tallyField: "rate", required: true },
  { apiField: "total", tallyXml: "AMOUNT", tallyField: "amount", required: false },
  { apiField: "discount_amount", tallyXml: "DISCOUNT", tallyField: "discount", required: false },
  { apiField: "tax_percent", tallyXml: "TAXRATE", tallyField: "tax_rate", required: false },
  { apiField: "cgst_amount", tallyXml: "CGST", tallyField: "cgst", required: false },
  { apiField: "sgst_amount", tallyXml: "SGST", tallyField: "sgst", required: false },
  { apiField: "igst_amount", tallyXml: "IGST", tallyField: "igst", required: false },
  { apiField: "hsn", tallyXml: "HSNCODE", tallyField: "hsn_code", required: false },
  { apiField: "order_id", tallyXml: "REFERENCE", tallyField: "reference_no", required: false },
  { apiField: "buyer_gstin", tallyXml: "PARTYGSTIN", tallyField: "buyer_gstin", required: false },
  { apiField: "buyer_address", tallyXml: "ADDRESS", tallyField: "buyer_address", required: false },
  { apiField: "buyer_state", tallyXml: "STATENAME", tallyField: "buyer_state", required: false },
  { apiField: "narration", tallyXml: "NARRATION", tallyField: "narration", required: false },
];

const SAMPLE_IMPORT_DATA = [
  { order_date: "2025-06-07", buyer_name: "Reliance Retail", sku_name: "Blue T-Shirt XL", qty: 10, selling_price: 599, total: 5990, cgst_amount: 269.55, sgst_amount: 269.55, hsn: "6109", buyer_gstin: "27AABCR1234F1Z5", order_id: "FY-ORD-10234" },
  { order_date: "2025-06-07", buyer_name: "DMart", sku_name: "Red Polo M", qty: 5, selling_price: 799, total: 3995, cgst_amount: 179.78, sgst_amount: 179.78, hsn: "6105", buyer_gstin: "27AAXYZ9876P1ZQ", order_id: "FY-ORD-10235" },
  { order_date: "2025-06-08", buyer_name: "Shoppers Stop", sku_name: "Black Jeans 32", qty: 8, selling_price: 1299, total: 10392, igst_amount: 935.28, hsn: "6204", buyer_gstin: "06AADCS1234H1Z8", order_id: "FY-ORD-10236" },
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/* --- FYND COMMERCE CONSOLE THEME --- */
const T = {
  // Sidebar - the "black patta"
  sidebarBg: "#1F1F25",
  sidebarBorder: "#2D2D35",
  sidebarHover: "#28283050",
  sidebarText: "#ABABBA",
  sidebarTextActive: "#FFFFFF",
  // Content area
  bg: "#F5F5F5",
  bgCard: "#FFFFFF",
  bgInput: "#FFFFFF",
  bgHover: "#F8F8FE",
  // Borders
  border: "#E4E5E6",
  borderFocus: "#2E31BE",
  borderActive: "#2E31BE",
  // Text
  text: "#41434C",
  textMuted: "#9B9B9B",
  textDim: "#BBBBC0",
  textDark: "#1F1F25",
  // Fynd primary blue
  accent: "#2E31BE",
  accentLight: "#5A5CE6",
  accentBg: "#EEEEFF",
  accentBg2: "rgba(46,49,190,0.06)",
  // Status
  green: "#0A8647",
  greenBg: "#E8F5E9",
  greenBdr: "#C8E6C9",
  red: "#CD3F3E",
  redBg: "#FFEBEE",
  blue: "#2E31BE",
  blueBg: "#E8EAF6",
  amber: "#E07C00",
  amberBg: "#FFF3E0",
  purple: "#7C4DFF",
  purpleBg: "#EDE7F6",
  // Fonts
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

/* --- SHARED COMPONENTS (Fynd Nitrozen style) --- */
function Toggle({ on, onChange, size = "md" }) {
  const w = size === "sm" ? 36 : 44;
  const h = size === "sm" ? 20 : 24;
  const d = size === "sm" ? 14 : 18;
  return (
    <button onClick={() => onChange(!on)} style={{
      width: w, height: h, borderRadius: h, border: "none", cursor: "pointer",
      background: on ? T.accent : "#D4D4D4", position: "relative", transition: "background 0.2s", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: (h - d) / 2, left: on ? w - d - 3 : 3,
        width: d, height: d, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

function Badge({ children, color = T.accent, bg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4,
      fontSize: 10, fontWeight: 600, color, background: bg || `${color}14`,
      letterSpacing: "0.04em", fontFamily: T.font, lineHeight: "18px",
    }}>{children}</span>
  );
}

function Btn({ children, variant = "primary", onClick, small, disabled, style: s }) {
  const base = {
    padding: small ? "7px 14px" : "10px 20px", borderRadius: 4, border: "none",
    fontSize: small ? 12 : 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: T.font, transition: "all 0.15s", display: "inline-flex",
    alignItems: "center", gap: 6, letterSpacing: "0.01em", opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: T.accent, color: "#fff" },
    secondary: { background: T.bgCard, color: T.text, border: `1px solid ${T.border}` },
    danger: { background: T.redBg, color: T.red, border: `1px solid ${T.red}30` },
    ghost: { background: "transparent", color: T.textMuted, padding: small ? "7px 10px" : "10px 14px" },
    success: { background: T.greenBg, color: T.green, border: `1px solid ${T.green}30` },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...s }}>{children}</button>;
}

function Input({ label, value, onChange, placeholder, type = "text", mono, textarea, rows = 3, info }) {
  const style = {
    width: "100%", padding: textarea ? "10px 14px" : "9px 14px",
    background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 4,
    color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: mono ? T.mono : T.font, resize: textarea ? "vertical" : "none",
    transition: "border-color 0.15s",
  };
  const El = textarea ? "textarea" : "input";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: T.text, fontFamily: T.font }}>{label}</label>
          {info && <span style={{ fontSize: 10, color: T.textMuted }}>({info})</span>}
        </div>
      )}
      <El type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={textarea ? rows : undefined} style={style}
        onFocus={(e) => e.target.style.borderColor = T.borderFocus}
        onBlur={(e) => e.target.style.borderColor = T.border} />
    </div>
  );
}

function Card({ children, title, subtitle, actions, style: s, noPad }) {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", ...s }}>
      {(title || actions) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div>
            {title && <div style={{ color: T.text, fontSize: 14, fontWeight: 600, fontFamily: T.font }}>{title}</div>}
            {subtitle && <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2, fontFamily: T.font }}>{subtitle}</div>}
          </div>
          {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: noPad ? 0 : "16px 20px" }}>{children}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 500, color: T.text, fontFamily: T.font }}>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        width: "100%", padding: "9px 14px", background: T.bgInput, border: `1px solid ${T.border}`,
        borderRadius: 4, color: T.text, fontSize: 13, outline: "none", fontFamily: T.font,
        cursor: "pointer", appearance: "auto", boxSizing: "border-box",
      }}>
        {options.map(o => typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}

function StatusDot({ active }) {
  return <span style={{
    width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0,
    background: active ? T.green : "#D4D4D4",
    boxShadow: active ? `0 0 6px ${T.green}60` : "none",
  }} />;
}

/* Icon helper - Fynd uses simple SVG icons */
function Icon({ name, size = 16, color = "currentColor" }) {
  const icons = {
    box: <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />,
    cart: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></>,
    refresh: <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></>,
    file: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    clipboard: <><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></>,
    play: <polygon points="5 3 19 12 5 21 5 3" />,
    download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    upload: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></>,
    link: <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    building: <><path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18" /><path d="M6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2" /><path d="M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    server: <><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></>,
    wifi: <><path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" /><path d="M8.53 16.11a6 6 0 016.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></>,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
}


/* --- PAGE: DASHBOARD --- */
function DashboardPage({ configs, schedules, mappings, b2bSettings, importData, tallyConn, setTallyConn }) {
  const activeApis = Object.values(configs).filter(c => c.enabled).length;
  const activeSchedules = Object.values(schedules).filter(s => s.enabled).length;
  const mappedFields = mappings.filter(m => m.tallyField).length;
  const parties = importData.length > 0 ? [...new Set(importData.map(r => r.buyer_name || r.party_name))].length : 0;

  const updateConn = (field, value) => setTallyConn(prev => ({ ...prev, [field]: value }));

  const testConnection = async () => {
    setTallyConn(prev => ({ ...prev, status: "checking", lastChecked: null }));
    try {
      const r = await api.testTallyConnection(tallyConn.host, tallyConn.port);
      setTallyConn(prev => ({
        ...prev,
        status: r.data?.status || "error",
        lastChecked: r.data?.lastChecked || new Date().toLocaleTimeString(),
        tallyVersion: r.data?.tallyVersion || "",
        companyName: r.data?.companyName || "",
      }));
    } catch (err) {
      setTallyConn(prev => ({
        ...prev, status: "error",
        lastChecked: new Date().toLocaleTimeString(),
      }));
    }
  };

  const stats = [
    { label: "Active APIs", value: activeApis, total: 5, color: T.accent, icon: "zap" },
    { label: "Scheduled Syncs", value: activeSchedules, total: 5, color: T.green, icon: "clock" },
    { label: "Mapped Fields", value: mappedFields, total: mappings.length, color: T.purple, icon: "link" },
    { label: "B2B Parties", value: parties, total: null, color: T.amber, icon: "building" },
  ];

  const isConnected = tallyConn.status === "connected";
  const isChecking = tallyConn.status === "checking";
  const isError = tallyConn.status === "error";

  const PLATFORMS = [
    { value: "windows", label: "Windows (Local)", icon: "monitor" },
    { value: "linux", label: "Linux Server", icon: "server" },
    { value: "cloud", label: "Cloud Hosted", icon: "globe" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ color: T.text, fontSize: 20, fontWeight: 700, margin: 0, fontFamily: T.font }}>Dashboard</h2>
        <p style={{ color: T.textMuted, fontSize: 13, margin: "4px 0 0", fontFamily: T.font }}>Tally Konnect Utility - Overview</p>
      </div>

      {/* --- TALLY SERVER CONNECTION --- */}
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden",
        borderLeft: `4px solid ${isConnected ? T.green : isError ? T.red : isChecking ? T.amber : T.textDim}`,
      }}>
        {/* Connection Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: isConnected ? T.greenBg : isError ? T.redBg : "#F5F5F5",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="server" size={20} color={isConnected ? T.green : isError ? T.red : T.textMuted} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: T.font }}>Tally Server Connection</div>
              <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.font, marginTop: 1 }}>
                Connect to Tally Prime running on Windows, Linux or Cloud
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Live status indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20,
              background: isConnected ? T.greenBg : isError ? T.redBg : isChecking ? T.amberBg : "#F5F5F5",
              border: `1px solid ${isConnected ? T.green + "30" : isError ? T.red + "30" : isChecking ? T.amber + "30" : T.border}`,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%", display: "inline-block",
                background: isConnected ? T.green : isError ? T.red : isChecking ? T.amber : "#D4D4D4",
                boxShadow: isConnected ? "0 0 8px " + T.green + "80" : isError ? "0 0 8px " + T.red + "60" : "none",
                animation: isChecking ? "pulse 1.2s ease-in-out infinite" : "none",
              }} />
              <span style={{
                fontSize: 12, fontWeight: 700, fontFamily: T.font,
                color: isConnected ? T.green : isError ? T.red : isChecking ? T.amber : T.textMuted,
              }}>
                {isConnected ? "CONNECTED" : isError ? "UNREACHABLE" : isChecking ? "CHECKING..." : "DISCONNECTED"}
              </span>
            </div>
          </div>
        </div>

        {/* Connection Config */}
        <div style={{ padding: "16px 20px" }}>
          {/* Platform Selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: T.text, fontFamily: T.font, display: "block", marginBottom: 8 }}>Platform</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PLATFORMS.map(p => (
                <button key={p.value} onClick={() => {
                  updateConn("platform", p.value);
                  if (p.value === "windows") updateConn("host", "http://localhost");
                  if (p.value === "linux") updateConn("host", "http://192.168.1.100");
                  if (p.value === "cloud") updateConn("host", "https://tally.yourcompany.com");
                  updateConn("status", "disconnected");
                }} style={{
                  flex: 1, padding: "10px 14px", borderRadius: 6, cursor: "pointer", fontFamily: T.font,
                  border: tallyConn.platform === p.value ? "1.5px solid " + T.accent : "1px solid " + T.border,
                  background: tallyConn.platform === p.value ? T.accentBg : T.bgCard,
                  color: tallyConn.platform === p.value ? T.accent : T.textMuted,
                  display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
                  fontWeight: tallyConn.platform === p.value ? 600 : 400, fontSize: 13, transition: "all 0.15s",
                }}>
                  <Icon name={p.icon} size={16} color={tallyConn.platform === p.value ? T.accent : T.textMuted} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL + Test */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: T.text, fontFamily: T.font }}>
                Tally Connection URL
              </label>
              <input
                value={tallyConn.port ? `${tallyConn.host}:${tallyConn.port}` : tallyConn.host}
                onChange={e => {
                  const val = e.target.value;
                  try {
                    // Try to parse URL to separate host and port
                    if (val.includes('://')) {
                      const url = new URL(val);
                      updateConn("host", `${url.protocol}//${url.hostname}`);
                      updateConn("port", url.port || "80");
                    } else if (val.includes(':')) {
                      const [h, p] = val.split(':');
                      updateConn("host", h);
                      updateConn("port", p);
                    } else {
                      updateConn("host", val);
                      // Don't clear port if user is still typing
                    }
                  } catch (err) {
                    updateConn("host", val);
                  }
                  updateConn("status", "disconnected");
                }}
                placeholder="http://localhost:9000"
                style={{
                  width: "100%", padding: "9px 14px", background: T.bgInput, border: "1px solid " + T.border,
                  borderRadius: 4, color: T.accent, fontSize: 13, fontFamily: T.mono, outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = T.borderFocus}
                onBlur={e => e.target.style.borderColor = T.border}
              />
            </div>
            <button onClick={testConnection} disabled={isChecking} style={{
              padding: "9px 20px", borderRadius: 4, border: "none",
              background: isChecking ? T.amberBg : T.accent, color: isChecking ? T.amber : "#fff",
              fontSize: 13, fontWeight: 600, cursor: isChecking ? "wait" : "pointer", fontFamily: T.font,
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", transition: "all 0.15s",
              opacity: isChecking ? 0.8 : 1,
              border: isChecking ? "1px solid " + T.amber + "40" : "none",
            }}>
              {isChecking ? (
                <><Icon name="activity" size={14} color={T.amber} /> Testing...</>
              ) : (
                <><Icon name="wifi" size={14} color="#fff" /> Test Connection</>
              )}
            </button>
          </div>

          {/* Full URL preview */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.font }}>Endpoint:</span>
            <code style={{ fontSize: 12, color: T.accent, fontFamily: T.mono, background: T.accentBg, padding: "2px 8px", borderRadius: 4 }}>
              {tallyConn.host}:{tallyConn.port}
            </code>
            {tallyConn.lastChecked && (
              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: T.font, marginLeft: "auto" }}>
                Last checked: {tallyConn.lastChecked}
              </span>
            )}
          </div>

          {/* Connection Result */}
          {isConnected && (
            <div style={{
              marginTop: 14, padding: "14px 16px", borderRadius: 6,
              background: T.greenBg, border: "1px solid " + T.greenBdr,
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 10, color: T.green, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: T.font }}>Status</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, boxShadow: "0 0 8px " + T.green + "80", display: "inline-block" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: T.font }}>Online</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.green, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: T.font }}>Tally Version</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font }}>{tallyConn.tallyVersion}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.green, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: T.font }}>Active Company</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font }}>{tallyConn.companyName}</div>
              </div>
            </div>
          )}

          {isError && (
            <div style={{
              marginTop: 14, padding: "14px 16px", borderRadius: 6,
              background: T.redBg, border: "1px solid " + T.red + "30",
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <Icon name="x" size={16} color={T.red} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.red, fontFamily: T.font, marginBottom: 4 }}>
                  Connection Failed
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.font, lineHeight: 1.6 }}>
                  Could not reach Tally at <code style={{ fontFamily: T.mono, color: T.red }}>{tallyConn.host}:{tallyConn.port}</code>. Please verify:
                </div>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: T.textMuted, fontFamily: T.font, lineHeight: 1.8 }}>
                  <li>Tally Prime is running and the server is started</li>
                  <li>Port <code style={{ fontFamily: T.mono }}>{tallyConn.port}</code> is open and not blocked by firewall</li>
                  {tallyConn.platform === "linux" && <li>Tally is running via Wine or TSS (Tally Server Setup) on Linux</li>}
                  {tallyConn.platform === "cloud" && <li>Cloud instance is running and URL/port is publicly accessible</li>}
                  <li>Tally ODBC / XML Server is enabled in F12 {"->"} Advanced Configuration</li>
                </ul>
              </div>
            </div>
          )}

          {/* Platform hints */}
          {tallyConn.status === "disconnected" && (
            <div style={{
              marginTop: 14, padding: "12px 16px", borderRadius: 6, background: "#FAFAFA", border: "1px solid " + T.border,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 8, fontFamily: T.font, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {tallyConn.platform === "windows" && "Windows Setup"}
                {tallyConn.platform === "linux" && "Linux Setup"}
                {tallyConn.platform === "cloud" && "Cloud Setup"}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.font, lineHeight: 1.7 }}>
                {tallyConn.platform === "windows" && (
                  <>Open Tally Prime {">"} F12 {">"} Advanced Configuration {">"} Set <strong>Enable ODBC Server = Yes</strong> and <strong>Port = 9000</strong>. The Tally server must be running on the same machine or accessible on the network.</>
                )}
                {tallyConn.platform === "linux" && (
                  <>Tally on Linux runs via <strong>Wine</strong> or <strong>Tally Server Setup (TSS)</strong>. Ensure the XML/ODBC server port is forwarded and accessible. Common ports: 9000 (default), 9090 (alt).</>
                )}
                {tallyConn.platform === "cloud" && (
                  <>Enter the public URL of your cloud-hosted Tally instance (AWS, Azure, GCP, or dedicated server). Ensure the Tally ODBC port is exposed via your cloud security group / firewall rules.</>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pulse animation for checking state */}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>

      {/* --- STAT CARDS --- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {stats.map((st, i) => (
          <div key={i} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "20px", borderTop: `3px solid ${st.color}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${st.color}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={st.icon} size={18} color={st.color} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: T.text, fontFamily: T.mono }}>{st.value}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4, fontFamily: T.font, fontWeight: 500 }}>
              {st.label}{st.total !== null && <span style={{ color: T.textDim }}> / {st.total}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Module Status" subtitle="API endpoint configuration">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SYNC_MODULES.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: configs[m.id]?.enabled ? T.accentBg : "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: configs[m.id]?.enabled ? T.accent : T.textMuted, fontFamily: T.font }}>{m.icon}</div>
                  <span style={{ fontSize: 13, color: T.text, fontFamily: T.font }}>{m.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusDot active={configs[m.id]?.enabled} />
                  <Badge color={configs[m.id]?.enabled ? T.green : T.textMuted}>
                    {configs[m.id]?.enabled ? "ACTIVE" : "OFF"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Sync Schedule" subtitle="Active cron jobs">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SYNC_MODULES.map(m => {
              const s = schedules[m.id];
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13, color: T.text, fontFamily: T.font }}>{m.label}</span>
                  {s?.enabled ? (
                    <code style={{ fontSize: 11, color: T.accent, background: T.accentBg, padding: "3px 8px", borderRadius: 4, fontFamily: T.mono }}>
                      {s.cron}
                    </code>
                  ) : (
                    <Badge color={T.textMuted}>NOT SCHEDULED</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Quick Actions">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="primary" small><Icon name="play" size={12} color="#fff" /> Run All Active Syncs</Btn>
          <Btn variant="secondary" small><Icon name="download" size={12} /> Import Sales Data</Btn>
          <Btn variant="secondary" small><Icon name="upload" size={12} /> Export Tally XML</Btn>
          <Btn variant="success" small><Icon name="search" size={12} color={T.green} /> Validate All Mappings</Btn>
        </div>
      </Card>
    </div>
  );
}

/* --- PAGE: API CONFIGURATION --- */
function ApiConfigPage({ configs, setConfigs }) {
  const [expanded, setExpanded] = useState(null);

  const update = (moduleId, field, value) => {
    setConfigs(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [field]: value }
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ color: T.text, fontSize: 20, fontWeight: 700, margin: 0, fontFamily: T.font }}>API Configuration</h2>
        <p style={{ color: T.textMuted, fontSize: 13, margin: "4px 0 0", fontFamily: T.font }}>
          Configure endpoints, headers & credentials for each sync module
        </p>
      </div>

      {SYNC_MODULES.map(m => {
        const cfg = configs[m.id];
        const isOpen = expanded === m.id;

        return (
          <div key={m.id} style={{
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderRadius: 8, overflow: "hidden", borderLeft: cfg.enabled ? `3px solid ${T.accent}` : `3px solid transparent`,
            transition: "all 0.2s",
          }}>
            <div onClick={() => setExpanded(isOpen ? null : m.id)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", cursor: "pointer", userSelect: "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: cfg.enabled ? T.accentBg : "#F0F0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: cfg.enabled ? T.accent : T.textMuted, fontFamily: T.font }}>{m.icon}</div>
                <div>
                  <div style={{ color: T.text, fontWeight: 600, fontSize: 14, fontFamily: T.font }}>{m.label}</div>
                  <div style={{ color: T.textMuted, fontSize: 12, fontFamily: T.font }}>{m.desc}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }} onClick={e => e.stopPropagation()}>
                <Toggle on={cfg.enabled} onChange={v => update(m.id, "enabled", v)} />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" style={{ transform: isOpen ? "rotate(180deg)" : "", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 16, paddingTop: 16 }}>
                <Input label="API Endpoint URL" value={cfg.endpoint} onChange={v => update(m.id, "endpoint", v)} placeholder="https://api.fynd.com/v1/..." mono />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Input label="Method" value={cfg.method} onChange={v => update(m.id, "method", v)} placeholder="POST" />
                  <Input label="Timeout (ms)" value={cfg.timeout} onChange={v => update(m.id, "timeout", v)} placeholder="30000" />
                </div>

                <Input label="Custom Headers" value={cfg.headers} onChange={v => update(m.id, "headers", v)}
                  placeholder={'{\n  "Content-Type": "application/json",\n  "x-api-key": "..."\n}'} mono textarea rows={4} info="JSON format" />

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: T.text, fontFamily: T.font, marginBottom: 8, display: "block" }}>Authentication</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["bearer", "api_key", "basic", "oauth2"].map(at => (
                      <button key={at} onClick={() => update(m.id, "authType", at)} style={{
                        padding: "7px 14px", borderRadius: 4, fontSize: 12, cursor: "pointer",
                        fontFamily: T.font, fontWeight: 600, transition: "all 0.15s",
                        border: cfg.authType === at ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
                        background: cfg.authType === at ? T.accentBg : T.bgInput,
                        color: cfg.authType === at ? T.accent : T.textMuted,
                      }}>
                        {at === "api_key" ? "API Key" : at === "basic" ? "Basic Auth" : at === "oauth2" ? "OAuth 2.0" : "Bearer Token"}
                      </button>
                    ))}
                  </div>
                </div>

                {cfg.authType === "bearer" && (
                  <Input label="Bearer Token" type="password" value={cfg.bearerToken} onChange={v => update(m.id, "bearerToken", v)} placeholder="Enter bearer token" mono />
                )}
                {cfg.authType === "api_key" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Input label="API Key Header" value={cfg.apiKeyHeader} onChange={v => update(m.id, "apiKeyHeader", v)} placeholder="x-api-key" />
                    <Input label="API Key Value" type="password" value={cfg.apiKey} onChange={v => update(m.id, "apiKey", v)} placeholder="Enter API key" />
                  </div>
                )}
                {cfg.authType === "basic" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Input label="Username" value={cfg.username} onChange={v => update(m.id, "username", v)} placeholder="Username" />
                    <Input label="Password" type="password" value={cfg.password} onChange={v => update(m.id, "password", v)} placeholder="Password" />
                  </div>
                )}
                {cfg.authType === "oauth2" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Input label="Client ID" value={cfg.clientId} onChange={v => update(m.id, "clientId", v)} placeholder="Client ID" mono />
                    <Input label="Client Secret" type="password" value={cfg.clientSecret} onChange={v => update(m.id, "clientSecret", v)} placeholder="Client Secret" />
                    <Input label="Token URL" value={cfg.tokenUrl} onChange={v => update(m.id, "tokenUrl", v)} placeholder="https://auth.example.com/token" mono />
                    <Input label="Scope" value={cfg.scope} onChange={v => update(m.id, "scope", v)} placeholder="read write" />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
                  <Btn variant="secondary" small onClick={async () => {
                    try {
                      const r = await api.testModuleConnection(m.id);
                      alert(r.data?.success ? `Connected (${r.data.responseTimeMs}ms)` : `Failed: ${r.data?.message}`);
                    } catch (e) { alert('Error: ' + e.message); }
                  }}><Icon name="search" size={12} /> Test Connection</Btn>
                  <Btn variant="primary" small onClick={async () => {
                    try {
                      await api.saveConfig(m.id, configs[m.id]);
                      alert("Config saved!");
                    } catch (e) { alert('Error: ' + e.message); }
                  }}><Icon name="check" size={12} color="#fff" /> Save</Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --- PAGE: FIELD MAPPING --- */
function FieldMappingPage({ mappings, setMappings }) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileRef = useRef(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploadStatus("loading");
    try {
      const r = await api.uploadMapping(file);
      setMappings(r.data?.mappings || r.data || []);
      setUploadStatus("loaded");
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadStatus(null);
    }
  };

  const updateRow = (idx, field, value) => {
    setMappings(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addRow = () => {
    setMappings(prev => [...prev, { apiField: "", tallyXml: "", tallyField: "", required: false }]);
  };

  const removeRow = (idx) => {
    setMappings(prev => prev.filter((_, i) => i !== idx));
  };

  const requiredCount = mappings.filter(m => m.required && m.tallyField).length;
  const totalRequired = TALLY_FIELDS.filter(f => f.required).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ color: T.text, fontSize: 20, fontWeight: 700, margin: 0, fontFamily: T.font }}>Field Mapping</h2>
          <p style={{ color: T.textMuted, fontSize: 13, margin: "4px 0 0", fontFamily: T.font }}>
            Map API JSON payload fields to Tally XML keys for voucher generation
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileRef} type="file" accept=".json,.xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleUpload} />
          <Btn variant="primary" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={14} color="#fff" /> Upload Mapping
          </Btn>
          <Btn variant="secondary" onClick={async () => {
            try { const r = await api.loadSampleMapping(); setMappings(r.data || []); } catch (e) { setMappings(SAMPLE_MAPPING); }
          }}>
            <Icon name="zap" size={14} /> Load Sample
          </Btn>
        </div>
      </div>

      {uploadStatus === "loaded" && (
        <div style={{
          background: T.greenBg, border: `1px solid ${T.greenBdr}`, borderRadius: 8,
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <Icon name="check" size={16} color={T.green} />
          <span style={{ fontSize: 13, color: T.green, fontFamily: T.font }}>
            Mapping template loaded -- {mappings.length} field mappings applied
          </span>
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 16, padding: "10px 16px",
        background: T.accentBg, borderRadius: 8, border: `1px solid ${T.accent}20`,
      }}>
        <span style={{ fontSize: 12, color: T.accent, fontFamily: T.font, fontWeight: 600 }}>
          Required fields mapped: {requiredCount} / {totalRequired}
        </span>
        <div style={{ flex: 1, height: 4, background: `${T.accent}20`, borderRadius: 2 }}>
          <div style={{ width: `${totalRequired ? (requiredCount / totalRequired) * 100 : 0}%`, height: "100%", background: T.accent, borderRadius: 2, transition: "width 0.3s" }} />
        </div>
        {requiredCount === totalRequired && <Badge color={T.green}>ALL REQUIRED MAPPED</Badge>}
      </div>

      <Card noPad>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: T.font }}>
            <thead>
              <tr style={{ background: "#FAFAFA" }}>
                {["", "API / JSON Field", "Tally XML Key", "Tally Field", "Required", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 14px", textAlign: "left", color: T.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${T.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mappings.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FAFBFF"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "8px 14px", color: T.textMuted, fontSize: 11, fontFamily: T.mono }}>{idx + 1}</td>
                  <td style={{ padding: "6px 10px" }}>
                    <input value={row.apiField} onChange={e => updateRow(idx, "apiField", e.target.value)}
                      placeholder="e.g. order_date" style={{
                        width: "100%", padding: "6px 10px", background: "#FAFAFA", border: `1px solid ${T.border}`,
                        borderRadius: 4, color: T.accent, fontSize: 12, fontFamily: T.mono, outline: "none", boxSizing: "border-box",
                      }} />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input value={row.tallyXml} onChange={e => updateRow(idx, "tallyXml", e.target.value)}
                      placeholder="e.g. DATE" style={{
                        width: "100%", padding: "6px 10px", background: "#FAFAFA", border: `1px solid ${T.border}`,
                        borderRadius: 4, color: T.purple, fontSize: 12, fontFamily: T.mono, outline: "none", boxSizing: "border-box",
                      }} />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <select value={row.tallyField || ""} onChange={e => updateRow(idx, "tallyField", e.target.value)} style={{
                      width: "100%", padding: "6px 10px", background: "#FAFAFA", border: `1px solid ${T.border}`,
                      borderRadius: 4, color: T.text, fontSize: 12, fontFamily: T.font, outline: "none", cursor: "pointer", boxSizing: "border-box",
                    }}>
                      <option value="">-- Select --</option>
                      {TALLY_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "6px 14px", textAlign: "center" }}>
                    <input type="checkbox" checked={row.required} onChange={e => updateRow(idx, "required", e.target.checked)}
                      style={{ accentColor: T.accent, width: 16, height: 16, cursor: "pointer" }} />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <button onClick={() => removeRow(idx)} style={{
                      background: "none", border: "none", color: T.textMuted, cursor: "pointer",
                      opacity: 0.5, transition: "opacity 0.15s", padding: 4, borderRadius: 4,
                    }} onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = T.redBg; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.background = "none"; }}>
                      <Icon name="x" size={14} color={T.red} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}` }}>
          <Btn variant="ghost" small onClick={addRow}>+ Add Mapping Row</Btn>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={async () => {
          try { const r = await api.getMappingsJson(); navigator.clipboard.writeText(JSON.stringify(r.data, null, 2)); alert("Copied to clipboard!"); } catch (e) { alert(e.message); }
        }}><Icon name="clipboard" size={14} /> Copy as JSON</Btn>
        <Btn variant="secondary" onClick={() => api.exportMapping()}><Icon name="download" size={14} /> Export Mapping</Btn>
        <Btn variant="primary" onClick={async () => {
          try { await api.saveMappings(mappings); alert("Mapping saved!"); } catch (e) { alert(e.message); }
        }}><Icon name="check" size={14} color="#fff" /> Save Mapping Config</Btn>
      </div>
    </div>
  );
}

/* --- PAGE: DATA IMPORT --- */
function DataImportPage({ mappings, importData, setImportData }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [tab, setTab] = useState("preview");
  const [batchId, setBatchId] = useState(null);
  const fileRef = useRef(null);

  const loadSample = async () => {
    try {
      const r = await api.loadSampleImport();
      setImportData(r.data.rows);
      setFileName(r.data.fileName);
      setBatchId(r.data.batchId);
    } catch (err) {
      console.error(err);
      setImportData(SAMPLE_IMPORT_DATA);
      setFileName("sample_sales_data.xlsx");
    }
  };

  const handleFile = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) { loadSample(); return; }
    try {
      const r = await api.uploadImportFile(file);
      setImportData(r.data.rows);
      setFileName(r.data.fileName);
      setBatchId(r.data.batchId);
    } catch (err) { console.error(err); loadSample(); }
  };

  const columns = importData.length > 0 ? Object.keys(importData[0]) : [];

  const generateXml = () => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n<HEADER>\n<TALLYREQUEST>Import Data</TALLYREQUEST>\n</HEADER>\n<BODY>\n<IMPORTDATA>\n<REQUESTDESC>\n<REPORTNAME>Vouchers</REPORTNAME>\n</REQUESTDESC>\n<REQUESTDATA>\n';

    importData.forEach(row => {
      xml += '<TALLYMESSAGE xmlns:UDF="TallyUDF">\n<VOUCHER VCHTYPE="Sales" ACTION="Create">\n';
      xml += '  <DATE>' + (row.order_date || "").replace(/-/g, "") + '</DATE>\n';
      xml += '  <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>\n';
      xml += '  <PARTYNAME>' + (row.buyer_name || row.party_name || "") + '</PARTYNAME>\n';
      xml += '  <NARRATION>' + (row.narration || ('Fynd Order: ' + (row.order_id || ""))) + '</NARRATION>\n';
      xml += '  <REFERENCE>' + (row.order_id || row.reference_no || "") + '</REFERENCE>\n';
      xml += '  <PARTYLEDGERNAME>' + (row.buyer_name || row.party_name || "") + '</PARTYLEDGERNAME>\n';
      xml += '  <ALLLEDGERENTRIES.LIST>\n';
      xml += '    <LEDGERNAME>' + (row.buyer_name || row.party_name || "") + '</LEDGERNAME>\n';
      xml += '    <AMOUNT>-' + (row.total || row.amount || (row.qty || 0) * (row.selling_price || 0)) + '</AMOUNT>\n';
      xml += '  </ALLLEDGERENTRIES.LIST>\n';
      xml += '  <ALLINVENTORYENTRIES.LIST>\n';
      xml += '    <STOCKITEMNAME>' + (row.sku_name || row.item_name || "") + '</STOCKITEMNAME>\n';
      xml += '    <BILLEDQTY>' + (row.qty || row.quantity || 0) + '</BILLEDQTY>\n';
      xml += '    <RATE>' + (row.selling_price || row.rate || 0) + '</RATE>\n';
      xml += '    <AMOUNT>' + (row.total || row.amount || 0) + '</AMOUNT>\n';
      if (row.hsn) xml += '    <HSNCODE>' + row.hsn + '</HSNCODE>\n';
      xml += '  </ALLINVENTORYENTRIES.LIST>\n';
      if (row.cgst_amount) {
        xml += '  <ALLLEDGERENTRIES.LIST>\n    <LEDGERNAME>CGST</LEDGERNAME>\n    <AMOUNT>' + row.cgst_amount + '</AMOUNT>\n  </ALLLEDGERENTRIES.LIST>\n';
      }
      if (row.sgst_amount) {
        xml += '  <ALLLEDGERENTRIES.LIST>\n    <LEDGERNAME>SGST</LEDGERNAME>\n    <AMOUNT>' + row.sgst_amount + '</AMOUNT>\n  </ALLLEDGERENTRIES.LIST>\n';
      }
      if (row.igst_amount) {
        xml += '  <ALLLEDGERENTRIES.LIST>\n    <LEDGERNAME>IGST</LEDGERNAME>\n    <AMOUNT>' + row.igst_amount + '</AMOUNT>\n  </ALLLEDGERENTRIES.LIST>\n';
      }
      xml += '</VOUCHER>\n</TALLYMESSAGE>\n';
    });

    xml += '</REQUESTDATA>\n</IMPORTDATA>\n</BODY>\n</ENVELOPE>';
    return xml;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ color: T.text, fontSize: 20, fontWeight: 700, margin: 0, fontFamily: T.font }}>Data Import</h2>
        <p style={{ color: T.textMuted, fontSize: 13, margin: "4px 0 0", fontFamily: T.font }}>
          Upload Excel/CSV sales data, preview & generate Tally XML
        </p>
      </div>

      {importData.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? T.accent : T.border}`,
            borderRadius: 8, padding: "60px 40px", textAlign: "center",
            background: dragOver ? T.accentBg : T.bgCard, cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFile} />
          <div style={{ marginBottom: 12 }}><Icon name="upload" size={40} color={T.textMuted} /></div>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 600, fontFamily: T.font }}>
            Drop Excel / CSV file here
          </div>
          <div style={{ color: T.textMuted, fontSize: 13, marginTop: 6, fontFamily: T.font }}>
            or click to browse -- supports .xlsx, .xls, .csv
          </div>
          <Btn variant="secondary" small style={{ marginTop: 16 }} onClick={(e) => { e.stopPropagation(); loadSample(); }}>
            <Icon name="zap" size={12} /> Load Sample Data
          </Btn>
        </div>
      ) : (
        <>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: T.greenBg, border: `1px solid ${T.greenBdr}`, borderRadius: 8, padding: "12px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="file" size={16} color={T.green} />
              <span style={{ color: T.green, fontSize: 13, fontFamily: T.font, fontWeight: 600 }}>{fileName}</span>
              <Badge color={T.green}>{importData.length} rows</Badge>
              <Badge color={T.accent}>{columns.length} columns</Badge>
            </div>
            <Btn variant="danger" small onClick={async () => {
              if (batchId) await api.clearImportData(batchId).catch(() => { });
              setImportData([]); setFileName(""); setBatchId(null);
            }}>
              <Icon name="x" size={12} color={T.red} /> Clear
            </Btn>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {[{ k: "preview", l: "Data Preview", ic: "grid" }, { k: "xml", l: "Tally XML Output", ic: "file" }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                padding: "8px 18px", borderRadius: 4, border: tab === t.k ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
                background: tab === t.k ? T.accentBg : T.bgCard, color: tab === t.k ? T.accent : T.textMuted,
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 6,
              }}>
                <Icon name={t.ic} size={13} color={tab === t.k ? T.accent : T.textMuted} /> {t.l}
              </button>
            ))}
          </div>

          {tab === "preview" && (
            <Card noPad>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: T.mono }}>
                  <thead>
                    <tr style={{ background: "#FAFAFA" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: T.textMuted, fontSize: 10, fontWeight: 600, borderBottom: `1px solid ${T.border}`, position: "sticky", left: 0, background: "#FAFAFA" }}>#</th>
                      {columns.map(col => (
                        <th key={col} style={{ padding: "8px 12px", textAlign: "left", color: T.textMuted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importData.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: "7px 12px", color: T.textMuted, position: "sticky", left: 0, background: T.bgCard }}>{i + 1}</td>
                        {columns.map(col => (
                          <td key={col} style={{ padding: "7px 12px", color: T.text, whiteSpace: "nowrap" }}>
                            {col === "buyer_gstin" && row[col] ? (
                              <span style={{ color: GSTIN_REGEX.test(row[col]) ? T.green : T.red }}>{String(row[col])}</span>
                            ) : String(row[col] != null ? row[col] : "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "xml" && (
            <Card title="Generated Tally XML" actions={<Btn variant="primary" small onClick={() => batchId && api.generateXml(batchId)}><Icon name="download" size={12} color="#fff" /> Download XML</Btn>}>
              <pre style={{
                background: "#FAFAFA", border: `1px solid ${T.border}`, borderRadius: 4,
                padding: 16, color: T.accent, fontSize: 11, fontFamily: T.mono,
                overflow: "auto", maxHeight: 400, lineHeight: 1.6, whiteSpace: "pre-wrap",
              }}>
                {generateXml()}
              </pre>
            </Card>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => batchId && api.generatePartyXml(batchId)}><Icon name="upload" size={14} /> Export Party Masters XML</Btn>
            <Btn variant="primary" onClick={() => batchId && api.generateXml(batchId)}><Icon name="file" size={14} color="#fff" /> Generate & Download Tally XML</Btn>
          </div>
        </>
      )}
    </div>
  );
}

/* --- PAGE: B2B SETTINGS --- */
function B2BSettingsPage({ b2bSettings, setB2bSettings, importData }) {
  const update = (field, value) => setB2bSettings(prev => ({ ...prev, [field]: value }));

  const parties = importData.length > 0
    ? [...new Map(importData.map(r => [r.buyer_name, r])).values()]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ color: T.text, fontSize: 20, fontWeight: 700, margin: 0, fontFamily: T.font }}>B2B Settings</h2>
        <p style={{ color: T.textMuted, fontSize: 13, margin: "4px 0 0", fontFamily: T.font }}>
          Auto party creation, GSTIN validation & B2B buyer management
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Auto Party Creation">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { key: "autoCreateParty", title: "Enable auto-create party ledgers", sub: "Automatically create missing party in Tally" },
              { key: "validateGstin", title: "GSTIN validation", sub: "Validate GSTIN format before import" },
              { key: "skipDuplicateGstin", title: "Skip duplicates by GSTIN", sub: "Don't create if GSTIN already exists" },
            ].map(item => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 600, fontFamily: T.font }}>{item.title}</div>
                  <div style={{ color: T.textMuted, fontSize: 11, fontFamily: T.font }}>{item.sub}</div>
                </div>
                <Toggle on={b2bSettings[item.key]} onChange={v => update(item.key, v)} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Default Party Settings">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Select label="Party Group" value={b2bSettings.partyGroup} onChange={v => update("partyGroup", v)}
              options={["Sundry Debtors", "B2B Customers", "Marketplace Buyers", "Sundry Creditors"]} />
            <Select label="GST Registration Type" value={b2bSettings.gstRegType} onChange={v => update("gstRegType", v)}
              options={["Regular", "Composition", "Consumer", "Unregistered"]} />
            <Select label="Default State" value={b2bSettings.defaultState} onChange={v => update("defaultState", v)}
              options={["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Gujarat", "Telangana", "West Bengal", "Rajasthan", "Uttar Pradesh"]} />
          </div>
        </Card>
      </div>

      <Card title="Party Field Mapping" subtitle="Map data columns to Tally party master fields">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {[
            { key: "partyNameCol", label: "Party Name Column", ph: "buyer_name", req: true },
            { key: "gstinCol", label: "GSTIN Column", ph: "buyer_gstin" },
            { key: "addressCol", label: "Address Column", ph: "buyer_address" },
            { key: "stateCol", label: "State Column", ph: "buyer_state" },
            { key: "pincodeCol", label: "Pincode Column", ph: "buyer_pincode" },
            { key: "contactCol", label: "Contact / Email", ph: "buyer_email" },
          ].map(f => (
            <Input key={f.key} label={f.label + (f.req ? " *" : "")} value={b2bSettings[f.key] || ""}
              onChange={v => update(f.key, v)} placeholder={f.ph} mono />
          ))}
        </div>
      </Card>

      {parties.length > 0 && (
        <Card title="Detected Parties from Import Data" subtitle={parties.length + " unique parties found"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {parties.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "#FAFAFA", borderRadius: 8, border: `1px solid ${T.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: T.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.accent, fontFamily: T.font }}>
                    {(p.buyer_name || "?")[0]}
                  </div>
                  <div>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 600, fontFamily: T.font }}>{p.buyer_name}</div>
                    {p.buyer_gstin && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <code style={{ fontSize: 11, color: GSTIN_REGEX.test(p.buyer_gstin) ? T.green : T.red, fontFamily: T.mono }}>{p.buyer_gstin}</code>
                        {GSTIN_REGEX.test(p.buyer_gstin)
                          ? <Badge color={T.green}>VALID</Badge>
                          : <Badge color={T.red}>INVALID</Badge>
                        }
                      </div>
                    )}
                  </div>
                </div>
                <Badge color={T.accent}>NEW</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* --- PAGE: SCHEDULER --- */
function SchedulerPage({ schedules, setSchedules }) {
  const update = (moduleId, field, value) => {
    setSchedules(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [field]: value }
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ color: T.text, fontSize: 20, fontWeight: 700, margin: 0, fontFamily: T.font }}>Sync Scheduler</h2>
        <p style={{ color: T.textMuted, fontSize: 13, margin: "4px 0 0", fontFamily: T.font }}>
          Configure automated sync frequency for each module
        </p>
      </div>

      {SYNC_MODULES.map(m => {
        const s = schedules[m.id];
        return (
          <div key={m.id} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
            borderLeft: s.enabled ? `3px solid ${T.green}` : `3px solid transparent`,
            padding: "18px 20px", transition: "all 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: s.enabled ? 16 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: s.enabled ? T.greenBg : "#F0F0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: s.enabled ? T.green : T.textMuted, fontFamily: T.font }}>{m.icon}</div>
                <div>
                  <div style={{ color: T.text, fontWeight: 600, fontSize: 14, fontFamily: T.font }}>{m.label}</div>
                  <div style={{ color: T.textMuted, fontSize: 12, fontFamily: T.font }}>
                    {s.enabled
                      ? <span>Active -- <code style={{ color: T.accent, fontFamily: T.mono }}>{s.cron}</code></span>
                      : "Disabled"
                    }
                  </div>
                </div>
              </div>
              <Toggle on={s.enabled} onChange={v => update(m.id, "enabled", v)} />
            </div>

            {s.enabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: T.text, fontFamily: T.font, display: "block", marginBottom: 8 }}>Frequency</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {SCHEDULE_PRESETS.map(p => (
                      <button key={p.id} onClick={() => {
                        update(m.id, "preset", p.id);
                        if (p.id !== "custom") update(m.id, "cron", p.cron);
                      }} style={{
                        padding: "7px 14px", borderRadius: 4, fontSize: 12, cursor: "pointer",
                        fontFamily: T.font, fontWeight: 600, transition: "all 0.15s", whiteSpace: "nowrap",
                        border: s.preset === p.id ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
                        background: s.preset === p.id ? T.accentBg : T.bgCard,
                        color: s.preset === p.id ? T.accent : T.textMuted,
                      }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {s.preset === "custom" && (
                  <div>
                    <Input label="Custom Cron Expression" value={s.cron} onChange={v => update(m.id, "cron", v)} placeholder="*/10 * * * *" mono />
                    <div style={{
                      marginTop: 8, padding: "10px 14px", background: "#FAFAFA", borderRadius: 4,
                      border: `1px solid ${T.border}`, fontSize: 11, color: T.textMuted, fontFamily: T.font, lineHeight: 1.7,
                    }}>
                      <span style={{ color: T.accent }}>Format:</span> minute hour day-of-month month day-of-week
                      <br /><span style={{ color: T.accent }}>Examples:</span>{" "}
                      <code style={{ color: T.text, fontFamily: T.mono }}>*/5 * * * *</code> = every 5 min,{" "}
                      <code style={{ color: T.text, fontFamily: T.mono }}>0 */2 * * *</code> = every 2 hours,{" "}
                      <code style={{ color: T.text, fontFamily: T.mono }}>0 9 * * 1</code> = Mon 9AM
                    </div>
                  </div>
                )}

                {s.preset === "daily" && (
                  <Select label="Run at (24h)" value={s.hour || "0"} onChange={v => {
                    update(m.id, "hour", v);
                    update(m.id, "cron", "0 " + v + " * * *");
                  }} options={Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: String(i).padStart(2, "0") + ":00" }))} />
                )}

                {s.preset === "weekly" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Select label="Day" value={s.weekday || "0"} onChange={v => {
                      update(m.id, "weekday", v);
                      update(m.id, "cron", "0 " + (s.hour || "0") + " * * " + v);
                    }} options={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => ({ value: String(i), label: d }))} />
                    <Select label="At hour" value={s.hour || "0"} onChange={v => {
                      update(m.id, "hour", v);
                      update(m.id, "cron", "0 " + v + " * * " + (s.weekday || "0"));
                    }} options={Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: String(i).padStart(2, "0") + ":00" }))} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="success" small onClick={async () => {
                    try {
                      const r = await api.runNow(m.id);
                      alert(r.data?.error ? `Error: ${r.data.error}` : `Done: ${r.data?.success || 0} sent, ${r.data?.failed || 0} failed`);
                    } catch (e) { alert(e.message); }
                  }}><Icon name="play" size={12} color={T.green} /> Run Now</Btn>
                  <Btn variant="secondary" small onClick={async () => {
                    try {
                      const r = await api.getScheduleLogs(m.id);
                      const logs = r.data?.logs || [];
                      alert(logs.length > 0
                        ? logs.slice(0, 10).map(l => `${l.status} | ${new Date(l.startedAt).toLocaleString()} | ${l.recordsSent} sent`).join('\n')
                        : 'No logs yet');
                    } catch (e) { alert(e.message); }
                  }}><Icon name="grid" size={12} /> View Logs</Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --- MAIN APP --- */
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "api", label: "API Config", icon: "settings" },
  { id: "mapping", label: "Field Mapping", icon: "link" },
  { id: "import", label: "Data Import", icon: "download" },
  { id: "b2b", label: "B2B Settings", icon: "building" },
  { id: "scheduler", label: "Scheduler", icon: "clock" },
];

// --- LOGIN SCREEN (SSO + OTP) ---
function LoginScreen({ onLogin }) {
  const [authConfig, setAuthConfig] = useState({ google: false, microsoft: false, emailOtp: true, mobileOtp: false });
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState('email');
  const [step, setStep] = useState('input');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [emailDelivered, setEmailDelivered] = useState(true);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  useEffect(() => { api.getAuthConfig().then(r => setAuthConfig(r.data)).catch(() => { }).finally(() => setAuthLoading(false)); }, []);
  useEffect(() => { if (resendTimer <= 0) return; const t = setTimeout(() => setResendTimer(r => r - 1), 1000); return () => clearTimeout(t); }, [resendTimer]);

  // Fix #5: Auto-submit OTP via useEffect to avoid race condition with setState
  useEffect(() => {
    if (otp.every(d => d) && step === 'otp' && !loading) {
      verifyOtpCode(otp.join(''));
    }
    // eslint-disable-next-line
  }, [otp]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userParam = params.get('user');
    const authError = params.get('error');
    if (token && userParam) {
      try {
        api.setToken(token);
        const user = JSON.parse(atob(decodeURIComponent(userParam)));
        api.setStoredUser(user);
        window.history.replaceState({}, '', '/');
        onLogin(user);
      } catch { setError('Authentication failed. Please try again.'); window.history.replaceState({}, '', '/'); }
    } else if (authError) {
      setError(authError.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()));
      window.history.replaceState({}, '', '/');
    }
  }, [onLogin]);

  const handleSendOtp = async () => {
    if (!identifier) return;
    setLoading(true); setError('');
    try {
      let result;
      if (mode === 'email') {
        result = await api.sendEmailOtp(identifier);
        setEmailDelivered(result.data?.delivered !== false);
      } else {
        await api.sendMobileOtp(identifier);
      }
      setStep('otp'); setResendTimer(30);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err) {
      if (err.status === 429) setError('Too many requests. Please wait a few minutes before trying again.');
      else if (err.status === 403) setError('Your account has been deactivated. Please contact your administrator.');
      else setError(err.message);
    } finally { setLoading(false); }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const n = [...otp]; n[index] = value.slice(-1); setOtp(n); setError('');
    if (value && index < 5) otpRefs[index + 1].current?.focus();
    // Auto-submit is handled by the useEffect watching `otp` state (Fix #5)
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs[index - 1].current?.focus();
    if (e.key === 'Enter' && otp.every(d => d)) verifyOtpCode(otp.join(''));
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split('')); otpRefs[5].current?.focus(); setTimeout(() => verifyOtpCode(pasted), 100); }
  };

  const verifyOtpCode = async (code) => {
    setLoading(true); setError('');
    try {
      const res = await api.verifyOtp(identifier, code, mode);
      api.setToken(res.data.token); api.setStoredUser(res.data.user); onLogin(res.data.user);
    } catch (err) {
      if (err.status === 429) setError('Too many incorrect attempts. Please request a new OTP.');
      else setError(err.message);
      setOtp(['', '', '', '', '', '']); otpRefs[0].current?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setOtp(['', '', '', '', '', '']); setError(''); setLoading(true);
    try { if (mode === 'email') await api.sendEmailOtp(identifier); else await api.sendMobileOtp(identifier); setResendTimer(30); } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const googleSvg = `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`;
  const msSvg = `<svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>`;

  const SsoBtn = ({ svg, label, hoverColor, onClick }) => (
    <button onClick={onClick} disabled={loading} style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: T.font, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = T.bg; e.currentTarget.style.borderColor = hoverColor; }}
      onMouseLeave={e => { e.currentTarget.style.background = T.bgCard; e.currentTarget.style.borderColor = T.border; }}>
      <span dangerouslySetInnerHTML={{ __html: svg }} />{label}
    </button>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, fontFamily: T.font, color: T.text }}>
      <div style={{ width: 400, padding: 36, background: T.bgCard, borderRadius: 12, border: `1px solid ${T.border}`, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon name="zap" size={22} color="#fff" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tally Konnect</h2>
        <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 24 }}>{step === 'otp' ? 'Enter the 6-digit code sent to' : 'Sign in or create your account'}</p>

        {step === 'otp' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark, marginBottom: 4 }}>{identifier}</div>
            <button onClick={() => { setStep('input'); setOtp(['', '', '', '', '', '']); setError(''); setEmailDelivered(true); }} style={{ background: 'none', border: 'none', color: T.accent, fontSize: 12, cursor: 'pointer', fontFamily: T.font, textDecoration: 'underline' }}>← Change email / go back</button>
            {!emailDelivered && mode === 'email' && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: T.amberBg, border: `1px solid ${T.amber}30`, fontSize: 11, color: T.amber, textAlign: 'left', lineHeight: 1.5 }}>
                ⚠️ Email delivery is not configured. Your OTP code is in the server logs.
              </div>
            )}
          </div>
        )}

        {step === 'input' && (
          <>
            {authLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0', marginBottom: 20 }}>
                <div style={{ width: 24, height: 24, border: `3px solid ${T.border}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {authConfig.google && <SsoBtn svg={googleSvg} label="Continue with Google" hoverColor="#4285F4" onClick={() => api.googleLogin()} />}
                {authConfig.microsoft && <SsoBtn svg={msSvg} label="Continue with Microsoft" hoverColor="#00A4EF" onClick={() => api.microsoftLogin()} />}
              </div>
            )}
            {(authConfig.google || authConfig.microsoft) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: T.border }} />
                <span style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>or continue with</span>
                <div style={{ flex: 1, height: 1, background: T.border }} />
              </div>
            )}
            {authConfig.mobileOtp && (
              <div style={{ display: 'flex', borderRadius: 6, border: `1px solid ${T.border}`, overflow: 'hidden', marginBottom: 14 }}>
                {['email', 'mobile'].map(t => (
                  <button key={t} onClick={() => { setMode(t); setIdentifier(''); setError(''); }} style={{ flex: 1, padding: '8px 0', border: 'none', fontSize: 12, fontWeight: 600, background: mode === t ? T.accent : 'transparent', color: mode === t ? '#fff' : T.textMuted, cursor: 'pointer', fontFamily: T.font, transition: 'all 0.15s', textTransform: 'capitalize' }}>{t}</button>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'left', marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>{mode === 'email' ? 'Email Address' : 'Mobile Number'}</label>
              <input type={mode === 'email' ? 'email' : 'tel'} value={identifier} onChange={e => { setIdentifier(e.target.value); setError(''); }} placeholder={mode === 'email' ? 'you@company.com' : '+91 98765 43210'} autoFocus onKeyDown={e => { if (e.key === 'Enter' && identifier) handleSendOtp(); }}
                style={{ width: '100%', padding: '10px 14px', background: T.bgInput, border: `1px solid ${error ? T.red : T.border}`, borderRadius: 6, color: T.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {error && <div style={{ fontSize: 12, color: T.red, textAlign: 'left', marginBottom: 10 }}>{error}</div>}
            <button onClick={handleSendOtp} disabled={loading || !identifier} style={{ width: '100%', padding: '11px 0', borderRadius: 6, border: 'none', background: loading || !identifier ? T.textMuted : T.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading || !identifier ? 'not-allowed' : 'pointer', fontFamily: T.font }}>
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              {otp.map((digit, i) => (
                <input key={i} ref={otpRefs[i]} type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  style={{ width: 44, height: 52, textAlign: 'center', fontSize: 20, fontWeight: 700, border: `2px solid ${error ? T.red : digit ? T.accent : T.border}`, borderRadius: 8, outline: 'none', background: T.bgInput, color: T.textDark, fontFamily: T.mono, transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => { if (!digit) e.target.style.borderColor = T.border; }} />
              ))}
            </div>
            {error && <div style={{ fontSize: 12, color: T.red, marginBottom: 10 }}>{error}</div>}
            <button onClick={() => verifyOtpCode(otp.join(''))} disabled={loading || otp.some(d => !d)} style={{ width: '100%', padding: '11px 0', borderRadius: 6, border: 'none', background: loading || otp.some(d => !d) ? T.textMuted : T.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading || otp.some(d => !d) ? 'not-allowed' : 'pointer', fontFamily: T.font, marginBottom: 12 }}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              Didn't receive the code?{' '}
              {resendTimer > 0 ? <span>Resend in {resendTimer}s</span> : (
                <button onClick={handleResend} style={{ background: 'none', border: 'none', color: T.accent, fontSize: 12, cursor: 'pointer', fontFamily: T.font, textDecoration: 'underline' }}>Resend</button>
              )}
            </div>
          </>
        )}
        <div style={{ marginTop: 20, fontSize: 11, color: T.textDim }}>By signing in, you agree to the terms of use.</div>
      </div>
    </div>
  );
}

// --- USER MANAGEMENT (Admin only) ---
function UserManagementPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const SUPER_ADMINS = ['mayurt@gofynd.com', 'mayur.thanekar@gmail.com'];

  useEffect(() => { api.getUsers().then(r => setUsers(r.data || [])).catch(() => { }); }, []);

  const handleToggleActive = async (u) => {
    if (SUPER_ADMINS.includes(u.email)) { setError('Cannot modify a super admin'); return; }
    try {
      const res = await api.updateUser(u.id, { is_active: !u.is_active });
      setUsers(users.map(x => x.id === u.id ? { ...x, ...res.data } : x));
      setSuccess(`User ${!u.is_active ? 'activated' : 'deactivated'}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) { setError(err.message); }
  };

  const handleRoleChange = async (u, newRole) => {
    if (SUPER_ADMINS.includes(u.email)) { setError('Cannot change role of a super admin'); return; }
    try {
      const res = await api.updateUser(u.id, { role: newRole });
      setUsers(users.map(x => x.id === u.id ? { ...x, ...res.data } : x));
      setSuccess('Role updated');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id, email) => {
    if (SUPER_ADMINS.includes(email)) { setError('Cannot delete a super admin'); return; }
    if (!window.confirm(`Delete user ${email}?`)) return;
    try { await api.deleteUser(id); setUsers(users.filter(u => u.id !== id)); } catch (err) { setError(err.message); }
  };

  const providerBadge = (provider) => {
    const map = { google: { l: 'Google', bg: '#E8F0FE', c: '#1A73E8' }, microsoft: { l: 'Microsoft', bg: '#E8F5FD', c: '#00A4EF' }, email_otp: { l: 'Email', bg: T.accentBg, c: T.accent }, mobile_otp: { l: 'Mobile', bg: T.amberBg, c: T.amber }, password: { l: 'Legacy', bg: T.bg, c: T.textMuted } };
    const p = map[provider] || map.email_otp;
    return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: p.bg, color: p.c }}>{p.l}</span>;
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: T.textDark }}>User Management</h2>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Users auto-register via Google, Microsoft, or Email OTP</div>
      </div>
      {success && <div style={{ padding: '10px 14px', background: T.greenBg, border: `1px solid ${T.greenBdr}`, borderRadius: 6, color: T.green, fontSize: 13, marginBottom: 16 }}>{success}</div>}
      {error && <div style={{ padding: '10px 14px', background: T.redBg, border: `1px solid ${T.red}`, borderRadius: 6, color: T.red, fontSize: 13, marginBottom: 16 }}>{error}<button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 16 }}>×</button></div>}
      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {['User', 'Auth', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isSA = SUPER_ADMINS.includes(u.email);
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: 99 }} /> : (
                        <div style={{ width: 32, height: 32, borderRadius: 99, background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: T.accent }}>{(u.name || u.email || '?')[0].toUpperCase()}</div>
                      )}
                      <div><div style={{ fontSize: 13, fontWeight: 500 }}>{u.email}</div><div style={{ fontSize: 11, color: T.textMuted }}>{u.name || '—'}</div></div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>{providerBadge(u.auth_provider)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {isSA ? <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: '#FFF3E0', color: '#E65100' }}>super admin</span> : (
                      <select value={u.role} onChange={e => handleRoleChange(u, e.target.value)} disabled={isSelf} style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 12, background: T.bgInput, color: T.text, cursor: isSelf ? 'not-allowed' : 'pointer' }}>
                        <option value="user">user</option><option value="admin">admin</option>
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px' }}><Toggle on={u.is_active} size="sm" onChange={() => handleToggleActive(u)} /></td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: T.textMuted }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 14px' }}>{!isSA && !isSelf && <button onClick={() => handleDelete(u.id, u.email)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${T.red}`, background: 'transparent', color: T.red, fontSize: 12, cursor: 'pointer' }}>Delete</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- DESKTOP BRIDGE PAGE ---
function DesktopBridgePage({ tallyConn }) {
  const DOWNLOAD_URL = '/api/download/bridge';
  const GITHUB_URL = 'https://github.com/mayurthanekar/tally-konnect/releases/latest';

  const steps = [
    { icon: 'download', title: 'Download', desc: 'Download the Tally Konnect Bridge installer (.exe) from GitHub Releases and install it on your Windows machine where Tally Prime is running.' },
    { icon: 'settings', title: 'Configure', desc: 'Launch the Bridge app. It will auto-detect Tally Prime on localhost:9000. If Tally runs on a different port, update the settings.' },
    { icon: 'zap', title: 'Connect', desc: 'Click "Start Tunnel" in the Bridge app. It creates a secure Cloudflare tunnel and registers with this cloud dashboard automatically.' },
    { icon: 'check-circle', title: 'Syncing', desc: 'Once connected, all API calls, schedules, and data imports configured here are routed through the tunnel to your local Tally Prime.' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: T.textDark }}>Desktop Bridge</h2>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Connect your local Tally Prime to the cloud dashboard</div>
      </div>

      {/* Status Banner */}
      <Card style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: tallyConn?.status === 'connected' ? T.greenBg : T.amberBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={tallyConn?.status === 'connected' ? 'check-circle' : 'alert-triangle'} size={20}
              color={tallyConn?.status === 'connected' ? T.green : T.amber} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark }}>
              {tallyConn?.status === 'connected' ? 'Bridge Connected' : 'Bridge Not Connected'}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {tallyConn?.status === 'connected'
                ? `Tally Prime ${tallyConn.tallyVersion || ''} — ${tallyConn.companyName || 'Unknown Company'}`
                : 'Install and launch the Desktop Bridge on your Windows machine to connect.'}
            </div>
          </div>
          <div style={{
            padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: tallyConn?.status === 'connected' ? T.greenBg : T.redBg,
            color: tallyConn?.status === 'connected' ? T.green : T.red,
            border: `1px solid ${tallyConn?.status === 'connected' ? T.greenBdr : T.red}`,
          }}>
            {tallyConn?.status || 'disconnected'}
          </div>
        </div>
      </Card>

      {/* Download CTA */}
      <Card style={{ marginBottom: 20, padding: 24, textAlign: 'center', background: `linear-gradient(135deg, ${T.accentBg}, ${T.bgCard})` }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Icon name="download" size={26} color="#fff" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: T.textDark }}>Download for Windows</h3>
        <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 18, maxWidth: 400, margin: '0 auto 18px' }}>
          The Desktop Bridge runs on your Windows machine alongside Tally Prime. It creates a secure tunnel to this cloud dashboard.
        </p>
        <button onClick={() => window.location.href = DOWNLOAD_URL} style={{
          padding: '12px 32px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.02em',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Icon name="download" size={16} color="#fff" />
            Download Bridge Package
          </span>
        </button>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10 }}>
          Requires Windows 10+ · Node.js 18+ · Tally Prime must be installed
        </div>
        <div style={{ marginTop: 8 }}>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.accent, textDecoration: 'none' }}>
            Or check GitHub Releases for pre-built .exe →
          </a>
        </div>
      </Card>

      {/* How it Works */}
      <Card style={{ marginBottom: 20, padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: T.textDark }}>How It Works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 14, background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: T.accentBg, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>{i + 1}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textDark, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Architecture */}
      <Card style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: T.textDark }}>Architecture</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', padding: 16 }}>
          {[
            { label: 'Tally Prime', sub: 'localhost:9000', color: T.blue },
            { label: '→', sub: '', color: T.textMuted },
            { label: 'Desktop Bridge', sub: 'Electron App', color: T.accent },
            { label: '→', sub: '', color: T.textMuted },
            { label: 'Cloudflare Tunnel', sub: 'Encrypted', color: T.purple },
            { label: '→', sub: '', color: T.textMuted },
            { label: 'Cloud Dashboard', sub: 'This app', color: T.green },
          ].map((item, i) => (
            item.sub === '' ? (
              <span key={i} style={{ fontSize: 18, color: T.textMuted, fontWeight: 300 }}>{item.label}</span>
            ) : (
              <div key={i} style={{
                padding: '12px 18px', borderRadius: 8, textAlign: 'center', minWidth: 100,
                background: T.bg, border: `1px solid ${T.border}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.label}</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>{item.sub}</div>
              </div>
            )
          ))}
        </div>
      </Card>
    </div>
  );
}

// --- MAIN WRAPPER ---
export default function TallyKonnectApp() {
  const [currentUser, setCurrentUser] = useState(api.getStoredUser());
  const [page, setPage] = useState("dashboard");
  const [saveStatus, setSaveStatus] = useState(null);
  const isAuth = !!currentUser;

  const [configs, setConfigs] = useState(() => {
    const init = {};
    SYNC_MODULES.forEach(m => {
      init[m.id] = {
        enabled: false, endpoint: "", method: "POST", timeout: "30000",
        headers: '{\n  "Content-Type": "application/json"\n}',
        authType: "bearer", bearerToken: "", apiKey: "", apiKeyHeader: "x-api-key",
        username: "", password: "", clientId: "", clientSecret: "", tokenUrl: "", scope: "",
      };
    });
    return init;
  });

  const [schedules, setSchedules] = useState(() => {
    const init = {};
    SYNC_MODULES.forEach(m => {
      init[m.id] = { enabled: false, preset: "hourly", cron: "0 * * * *", hour: "0", weekday: "0" };
    });
    return init;
  });

  const [mappings, setMappings] = useState([]);
  const [importData, setImportData] = useState([]);
  const [tallyConn, setTallyConn] = useState({
    host: "http://localhost",
    port: "9000",
    platform: "windows",
    status: "disconnected",  // disconnected | checking | connected | error
    lastChecked: null,
    tallyVersion: "",
    companyName: "",
  });
  const [b2bSettings, setB2bSettings] = useState({
    autoCreateParty: true, validateGstin: true, skipDuplicateGstin: true,
    partyGroup: "Sundry Debtors", gstRegType: "Regular", defaultState: "Maharashtra",
    partyNameCol: "buyer_name", gstinCol: "buyer_gstin", addressCol: "buyer_address",
    stateCol: "buyer_state", pincodeCol: "buyer_pincode", contactCol: "",
  });

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await api.saveAll({
        configs, schedules, mappings, b2bSettings,
        tallyConn: { host: tallyConn.host, port: tallyConn.port, platform: tallyConn.platform },
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus(null);
    }
  };

  // Load all saved data from backend on app startup
  useEffect(() => {
    api.getTallyConnection().then(r => {
      if (r.data) setTallyConn(prev => ({
        ...prev,
        host: r.data.host || prev.host,
        port: r.data.port || prev.port,
        platform: r.data.platform || prev.platform,
        status: r.data.status || "disconnected",
        tallyVersion: r.data.tally_version || "",
        companyName: r.data.company_name || "",
      }));
    }).catch(() => { });
    api.getConfigs().then(r => r.data && setConfigs(prev => ({ ...prev, ...r.data }))).catch(() => { });
    api.getSchedules().then(r => r.data && setSchedules(prev => ({ ...prev, ...r.data }))).catch(() => { });
    api.getMappings().then(r => r.data && Array.isArray(r.data) && r.data.length > 0 && setMappings(r.data)).catch(() => { });
    api.getB2bSettings().then(r => r.data && setB2bSettings(prev => ({ ...prev, ...r.data }))).catch(() => { });
  }, []);

  const handleLogout = () => { api.clearToken(); setCurrentUser(null); };

  if (!isAuth) return <LoginScreen onLogin={(user) => setCurrentUser(user)} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: T.font, color: T.text, overflow: "hidden" }}>
      {/* Google Fonts loaded via public/index.html */}

      {/* --- SIDEBAR (Black Patta) --- */}
      <div style={{
        width: 240, background: T.sidebarBg, borderRight: `1px solid ${T.sidebarBorder}`,
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "18px 16px", borderBottom: `1px solid ${T.sidebarBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: T.accent,
            }}>
              <Icon name="zap" size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#FFFFFF", lineHeight: 1.2 }}>Tally Konnect</div>
              <div style={{ fontSize: 10, color: T.accent, fontWeight: 600, letterSpacing: "0.06em" }}>UTILITY SUITE v2.0</div>
            </div>
          </div>
        </div>

        {/* Mini Stats */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.sidebarBorder}`, display: "flex", gap: 8 }}>
          {[
            { v: Object.values(configs).filter(c => c.enabled).length, l: "APIs", c: T.accent },
            { v: Object.values(schedules).filter(s => s.enabled).length, l: "Crons", c: T.green },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: "8px 10px", background: "#282830", borderRadius: 6, textAlign: "center", border: `1px solid ${T.sidebarBorder}` }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.c, fontFamily: T.mono }}>{s.v}</div>
              <div style={{ fontSize: 9, color: T.sidebarText, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
          <div style={{ padding: "0 16px", marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: "#6B6B78", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Navigation</span>
          </div>
          {NAV_ITEMS.map(n => {
            const isActive = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px",
                background: isActive ? `${T.accent}15` : "transparent",
                borderLeft: `3px solid ${isActive ? T.accent : "transparent"}`,
                border: "none", borderRight: "none", borderTop: "none", borderBottom: "none",
                borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: isActive ? T.accent : "transparent",
                color: isActive ? "#FFFFFF" : T.sidebarText,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                cursor: "pointer", fontFamily: T.font, textAlign: "left", transition: "all 0.15s",
              }}>
                <Icon name={n.icon} size={16} color={isActive ? T.accent : T.sidebarText} />
                {n.label}
              </button>
            );
          })}

          <div style={{ padding: "16px 16px 8px 16px", marginTop: 10, borderTop: "1px solid #2D2D35" }}>
            <div style={{ fontSize: 10, color: "#6B6B78", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 }}>Tools</div>
            <button onClick={() => setPage('bridge')} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 0",
              background: "transparent", border: "none", color: page === 'bridge' ? '#fff' : T.sidebarText,
              fontSize: 13, fontWeight: page === 'bridge' ? 600 : 400, cursor: "pointer", fontFamily: T.font, textAlign: "left",
            }}>
              <Icon name="download" size={16} color={page === 'bridge' ? T.accent : T.sidebarText} />
              Desktop Bridge
            </button>
          </div>
          {currentUser?.role === 'admin' && (
            <div style={{ padding: "16px 16px 8px 16px", borderTop: "1px solid #2D2D35" }}>
              <div style={{ fontSize: 10, color: "#6B6B78", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 }}>Admin</div>
              <button onClick={() => setPage('users')} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 0",
                background: "transparent", border: "none", color: page === 'users' ? '#fff' : T.sidebarText,
                fontSize: 13, fontWeight: page === 'users' ? 600 : 400, cursor: "pointer", fontFamily: T.font, textAlign: "left",
              }}>
                <Icon name="users" size={16} color={page === 'users' ? T.accent : T.sidebarText} />
                Users
              </button>
            </div>
          )}
        </nav>

        {/* Save + Logout */}
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${T.sidebarBorder}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={handleSave} style={{
            width: "100%", padding: "10px 0", borderRadius: 4, border: "none",
            background: saveStatus === "saved" ? T.green : T.accent,
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: T.font, transition: "all 0.2s", letterSpacing: "0.02em",
          }}>
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save All Config"}
          </button>
          <button onClick={handleLogout} style={{
            width: "100%", padding: "8px 0", borderRadius: 4, border: `1px solid ${T.sidebarBorder}`,
            background: "transparent", color: T.sidebarText, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: T.font,
          }}>
            Sign out ({currentUser?.email?.split('@')[0]})
          </button>
        </div>
      </div>

      {/* --- MAIN AREA --- */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {page === "dashboard" && <DashboardPage configs={configs} schedules={schedules} mappings={mappings} b2bSettings={b2bSettings} importData={importData} tallyConn={tallyConn} setTallyConn={setTallyConn} />}
          {page === "api" && <ApiConfigPage configs={configs} setConfigs={setConfigs} />}
          {page === "mapping" && <FieldMappingPage mappings={mappings} setMappings={setMappings} />}
          {page === "import" && <DataImportPage mappings={mappings} importData={importData} setImportData={setImportData} />}
          {page === "b2b" && <B2BSettingsPage b2bSettings={b2bSettings} setB2bSettings={setB2bSettings} importData={importData} />}
          {page === "scheduler" && <SchedulerPage schedules={schedules} setSchedules={setSchedules} />}
          {page === "users" && <UserManagementPage currentUser={currentUser} />}
          {page === "bridge" && <DesktopBridgePage tallyConn={tallyConn} />}
        </div>
      </div>
    </div>
  );
}

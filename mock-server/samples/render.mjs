/** HTML for each kind of sample document. `build.mjs` prints it to PDF or takes a picture. */
import { OWNER, STUDIO } from './people.mjs';

const esc = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const money = (n) =>
  `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CSS = `
@page { size: Letter; margin: 0.8in 0.85in 0.9in; }
* { box-sizing: border-box; }
body { margin: 0; font: 10.5pt/1.5 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1c2024; }
.mark { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
.org { font-weight: 700; font-size: 14pt; letter-spacing: -0.01em; }
.org-lines, .muted { color: #60646c; font-size: 9pt; line-height: 1.45; }
h1 { font-size: 17pt; margin: 0 0 6px; letter-spacing: -0.01em; }
h2 { font-size: 11pt; margin: 18px 0 4px; }
p { margin: 0 0 9px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: #60646c; border-bottom: 1.5px solid #1c2024; padding: 6px 4px; }
td { padding: 7px 4px; border-bottom: 1px solid #e0e1e6; vertical-align: top; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr.total td { font-weight: 700; border-bottom: none; border-top: 1.5px solid #1c2024; }
.kv td:first-child { width: 38%; color: #60646c; }
.rule { width: 48px; height: 5px; border-radius: 3px; background: var(--accent); margin: 0 0 22px; }
.box { border: 1px solid #e0e1e6; border-radius: 6px; padding: 12px 14px; margin: 14px 0; background: #f9f9fb; }
.sigs { display: flex; gap: 40px; margin-top: 36px; break-inside: avoid; }
.sig { flex: 1; }
.sig-line { height: 42px; border-bottom: 1px solid #1c2024; font: italic 20pt/42px "Snell Roundhand", "Brush Script MT", cursive; color: #1d3a8a; }
.draft { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 96pt; font-weight: 800; color: rgba(229, 72, 77, 0.10); transform: rotate(-24deg); }
.stamp { display: inline-block; border: 2px solid #2e7d32; color: #2e7d32; border-radius: 4px; padding: 2px 10px; font-weight: 700; font-size: 9pt; letter-spacing: 0.08em; transform: rotate(-3deg); }
`;

/** The footer of every PDF page. Chromium prints it in the bottom margin. */
export const PDF_FOOTER = `<div style="width:100%;font:7pt Helvetica,Arial,sans-serif;color:#8b8d98;display:flex;justify-content:space-between;padding:0 0.85in">
<span>Sample document · fictional data for the Papermint demo</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

function page(body, accent = '#3e63dd', extraCss = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${extraCss}</style></head><body style="--accent:${accent}"><div class="rule"></div>${body}</body></html>`;
}

function head(org, right = '') {
  return `<div class="mark"><div><div class="org">${esc(org.name)}</div><div class="org-lines">${org.lines.map(esc).join('<br>')}</div></div><div class="org-lines" style="text-align:right">${right}</div></div>`;
}

const address = (lines) => `<p>${lines.map(esc).join('<br>')}</p>`;

function letter(d) {
  return page(
    `${head(d.from, esc(d.date))}${address(d.to)}<h2>${esc(d.subject)}</h2>${d.paragraphs
      .map((p) => `<p>${esc(p)}</p>`)
      .join('')}<p style="margin-top:28px">Sincerely,</p><p><strong>${esc(d.sign)}</strong></p>`,
  );
}

function form(d) {
  const rows = d.fields.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
  return page(
    `${head(d.issuer)}<h1>${esc(d.heading)}</h1><table class="kv">${rows}</table>${
      d.note ? `<div class="box">${esc(d.note)}</div>` : ''
    }`,
    '#12a594',
  );
}

function agreement(d, variant) {
  const sections = d.sections
    .map(
      ([title, paras], i) =>
        `<h2>${i + 1}. ${esc(title)}</h2>${paras.map((p) => `<p>${esc(p)}</p>`).join('')}`,
    )
    .join('');
  const sigs = d.signatures
    .map(
      ([name, role]) =>
        `<div class="sig"><div class="sig-line">${variant.draft ? '' : esc(name)}</div><div><strong>${esc(name)}</strong></div><div class="muted">${esc(role)}</div></div>`,
    )
    .join('');
  return page(
    `${variant.draft ? '<div class="draft">DRAFT</div>' : ''}${head(d.issuer)}<h1>${esc(d.heading)}</h1><p class="muted">${esc(d.intro)}</p>${sections}<div class="sigs">${sigs}</div>`,
    '#6e56cf',
  );
}

function invoice(d) {
  const issuer = d.issuer ?? STUDIO;
  const lines = d.items.map(([text, qty, rate]) => [text, qty, rate, qty * rate]);
  const total = lines.reduce((sum, l) => sum + l[3], 0);
  const rows = lines
    .map(
      ([text, qty, rate, amount]) =>
        `<tr><td>${esc(text)}</td><td class="num">${qty}</td><td class="num">${money(rate)}</td><td class="num">${money(amount)}</td></tr>`,
    )
    .join('');
  const client = d.client ?? OWNER;
  return page(
    `${head(issuer, `<strong>Invoice ${esc(d.number)}</strong><br>${esc(d.date)}<br>Due: ${esc(d.due)}`)}
    <div class="muted">Bill to</div>${address([client.name, ...client.lines])}
    <table><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>${rows}
    <tr class="total"><td colspan="3">Total</td><td class="num">${money(total)}</td></tr></table>
    ${d.terms ? `<p class="muted">${esc(d.terms)}</p>` : ''}
    ${issuer === STUDIO ? `<div class="box">Pay by bank transfer to ${esc(STUDIO.name)}, account ••••2093, or by check. Thank you for your business.</div>` : ''}`,
    issuer === STUDIO ? '#8e4ec6' : '#0d74ce',
  );
}

function statement(d) {
  const rows = d.rows
    .map(
      ([date, text, amount, balance]) =>
        `<tr><td>${date}</td><td>${esc(text)}</td><td class="num">${money(amount)}</td><td class="num">${money(balance)}</td></tr>`,
    )
    .join('');
  const ins = d.rows.filter((r) => r[2] > 0).reduce((s, r) => s + r[2], 0);
  const outs = d.rows.filter((r) => r[2] < 0).reduce((s, r) => s + r[2], 0);
  return page(
    `${head(d.bank, `<strong>Statement</strong><br>${esc(d.label)}`)}${address([d.holder.name, ...d.holder.lines])}
    <div class="box"><table class="kv" style="margin:0"><tr><td>Account</td><td>${esc(d.account)}</td></tr>
    <tr><td>Opening balance</td><td>${money(d.opening)}</td></tr><tr><td>Deposits</td><td>${money(ins)}</td></tr>
    <tr><td>Withdrawals</td><td>${money(outs)}</td></tr><tr><td><strong>Closing balance</strong></td><td><strong>${money(d.closing)}</strong></td></tr></table></div>
    <table><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th class="num">Balance</th></tr>${rows}</table>`,
    '#0d74ce',
  );
}

function bill(d) {
  const total = d.charges.reduce((s, c) => s + c[1], 0);
  const rows = d.charges
    .map(([text, amount]) => `<tr><td>${esc(text)}</td><td class="num">${money(amount)}</td></tr>`)
    .join('');
  return page(
    `${head(d.issuer, `Account ${esc(d.account)}<br>${esc(d.period)}`)}${address([OWNER.name, ...OWNER.lines])}
    <div class="box" style="display:flex;justify-content:space-between"><div><div class="muted">Amount due</div><div style="font-size:22pt;font-weight:700">${money(total)}</div></div>
    <div style="text-align:right"><div class="muted">Due by</div><div style="font-size:13pt;font-weight:600">${esc(d.due)}</div><div class="muted">Usage: ${esc(d.usage)}</div></div></div>
    <table><tr><th>Charge</th><th class="num">Amount</th></tr>${rows}<tr class="total"><td>Total</td><td class="num">${money(total)}</td></tr></table>
    <p class="muted">Autopay is on for this account. We will charge your card on file on the due date.</p>`,
    '#ffb224',
  );
}

const RECEIPT_CSS = `
body { width: 340px; padding: 26px 22px 30px; font: 12px/1.45 "Courier New", Courier, monospace; background: #fdfcf8; }
.rule { display: none; }
.c { text-align: center; } .row { display: flex; justify-content: space-between; } hr { border: none; border-top: 1px dashed #8b8d98; margin: 10px 0; }`;

function receipt(d) {
  const subtotal = d.items.reduce((s, i) => s + i[1], 0);
  const rows = d.items
    .map(([t, a]) => `<div class="row"><span>${esc(t)}</span><span>${money(a)}</span></div>`)
    .join('');
  return page(
    `<div class="c"><strong style="font-size:15px">${esc(d.store.toUpperCase())}</strong><br>${d.lines.map(esc).join('<br>')}<br>${esc(d.date)}</div><hr>${rows}<hr>
    <div class="row"><span>SUBTOTAL</span><span>${money(subtotal)}</span></div><div class="row"><span>TAX</span><span>$0.00</span></div>
    <div class="row"><strong>TOTAL</strong><strong>${money(subtotal)}</strong></div><hr><div>${esc(d.payment)} APPROVED</div>
    <div class="c" style="margin-top:14px">THANK YOU<br><span style="font-size:10px">Sample receipt · fictional data</span></div>`,
    '#000',
    RECEIPT_CSS,
  );
}

const CARD_CSS = `
body { width: 520px; padding: 20px; background: #eef1f6; }
.rule { display: none; }
.card { background: #fff; border-radius: 14px; padding: 22px 24px; box-shadow: 0 1px 3px rgba(0,0,0,.15); border-top: 8px solid #3e63dd; }`;

function card(d) {
  const rows = d.fields
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`)
    .join('');
  return page(
    `<div class="card"><div class="org">${esc(d.issuer.name)}</div><div class="muted">${esc(d.title)} · ${d.issuer.lines.map(esc).join(' · ')}</div>
    <table class="kv">${rows}</table><div class="muted">Keep this card in the vehicle. Sample card · fictional data.</div></div>`,
    '#3e63dd',
    CARD_CSS,
  );
}

const RENDER = { letter, form, agreement, invoice, statement, bill, receipt, card };

/** How each kind is stored: a PDF, a picture or plain text. */
export const FORMAT = {
  letter: 'pdf',
  form: 'pdf',
  agreement: 'pdf',
  invoice: 'pdf',
  statement: 'pdf',
  bill: 'pdf',
  receipt: 'jpg',
  card: 'jpg',
  note: 'txt',
};

export function renderHtml(entry, variant = {}) {
  return RENDER[entry.kind](entry.data, variant);
}

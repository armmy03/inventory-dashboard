const sheetUrl = 'https://script.google.com/macros/s/AKfycbzQTPqz-udUL6CCUZdR1mxVM0SMNr9vWTBfda80rtd68cjtfE0AlLSpqc2zJ0hb1_Q99A/exec';
function setupSidebar() {
  const toggle = document.querySelector('#navToggle');
  if (!toggle) return;
  let collapsed = window.matchMedia('(max-width: 760px)').matches;
  try { collapsed = localStorage.getItem('printer-sidebar-collapsed') === 'true' || (localStorage.getItem('printer-sidebar-collapsed') === null && collapsed); } catch {}
  const update = () => { document.body.classList.toggle('sidebar-collapsed', collapsed); toggle.setAttribute('aria-expanded', String(!collapsed)); toggle.setAttribute('aria-label', collapsed ? 'ขยายเมนู' : 'ยุบเมนู'); };
  toggle.addEventListener('click', () => { collapsed = !collapsed; try { localStorage.setItem('printer-sidebar-collapsed', String(collapsed)); } catch {} update(); });
  update();
}
setupSidebar();
const columns = ['unit','floor','department','model','ink','location','asset','note'];
const aliases = { unit:['หน่วยงาน','ตึก','อาคาร'], floor:['ชั้น'], department:['แผนก'], model:['รุ่น-ยี่ห้อ','รุ่น','ยี่ห้อ'], ink:['หมึก'], location:['ตำแหน่ง'], asset:['ครุภัณฑ์/id','ครุภัณฑ์','id'], note:['หมายเหตุ'] };
const status = document.querySelector('#syncStatus');

function loadGoogleSheet() { return new Promise((resolve, reject) => { const script = document.createElement('script'); const cleanup = () => { clearTimeout(timeout); script.remove(); delete window.receivePrinterData; }; const timeout = setTimeout(() => { cleanup(); reject(new Error('หมดเวลารอข้อมูล')); }, 12000); window.receivePrinterData = response => { cleanup(); if (!response?.ok || !Array.isArray(response.values) || response.values.length < 2) { reject(new Error(response?.error || 'รูปแบบข้อมูลไม่ถูกต้อง')); return; } const header = response.values[0].map(value => String(value).trim().toLowerCase()); const index = Object.fromEntries(columns.map(key => [key, header.findIndex(value => aliases[key].includes(value))])); const items = response.values.slice(1).map(row => Object.fromEntries(columns.map(key => [key, index[key] < 0 ? '' : String(row[index[key]] || '').trim()]))).filter(item => Object.values(item).some(Boolean)); items.forEach(item => { if (!item.floor && ['100 y', '100y', 'OPD'].includes(item.unit)) item.floor = 'G'; }); resolve(items); }; script.src = `${sheetUrl}?action=read&_=${Date.now()}`; script.onerror = () => { cleanup(); reject(new Error('โหลดข้อมูลไม่สำเร็จ')); }; document.head.append(script); }); }
function countBy(items, key) { return Object.entries(items.reduce((all, item) => { const name = item[key] || 'ไม่ระบุ'; all[name] = (all[name] || 0) + 1; return all; }, {})).sort((a,b) => b[1] - a[1]); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
function updateHospitalCount(items) { const hospitalCount = items.filter(item => { const assetId = item.asset.trim(); return /\d/.test(assetId) && /^[\d\s./-]+$/.test(assetId); }).length; document.querySelector('#modelStat').textContent = hospitalCount; }
function render(items) { const valid = items.filter(item => item.model || item.department); const buildings = countBy(valid, 'unit'); const departments = countBy(valid, 'department'); const inks = countBy(valid, 'ink'); const stickerCount = valid.filter(item => item.ink.trim().toLowerCase() === 'sticker').length; const rentalCount = valid.filter(item => item.asset.trim().includes('เช่า')).length; const models = new Set(valid.map(item => item.model).filter(Boolean)); const modelGroups = Object.values(valid.reduce((all, item) => { const model = item.model || 'ไม่ระบุรุ่น'; const ink = item.ink || 'ไม่ระบุ'; const key = `${model}|||${ink}`; if (!all[key]) all[key] = { model, ink, count: 0 }; all[key].count += 1; return all; }, {})).sort((a, b) => b.count - a.count || a.model.localeCompare(b.model)); const colors = ['#19735a','#52a878','#8bcf9f','#b5df7c','#4a8fbe','#8d78b8']; document.querySelector('#totalStat').textContent = valid.length; document.querySelector('#stickerStat').textContent = stickerCount; document.querySelector('#rentalStat').textContent = rentalCount; document.querySelector('#modelStat').textContent = models.size; document.querySelector('#inkTypeStat').textContent = inks.length; document.querySelector('#chartTotal').textContent = valid.length; let offset = 0; document.querySelector('#buildingChart').innerHTML = `<circle class="donut-base" cx="60" cy="60" r="45" pathLength="100"></circle>${buildings.map(([name, count], index) => { const percent = (count / valid.length) * 100; const segment = `<circle class="donut-segment" cx="60" cy="60" r="45" pathLength="100" stroke="${colors[index % colors.length]}" stroke-dasharray="${percent} ${100 - percent}" stroke-dashoffset="-${offset}"><title>${escapeHtml(name)}: ${count} รายการ</title></circle>`; offset += percent; return segment; }).join('')}`; document.querySelector('#buildingLegend').innerHTML = buildings.map(([name, count], index) => `<div class="legend-row"><i style="background:${colors[index % colors.length]}"></i><span>${escapeHtml(name)}</span><strong>${count}</strong></div>`).join(''); const maxInk = inks[0]?.[1] || 1; document.querySelector('#inkList').innerHTML = inks.map(([name, count], index) => `<article class="ink-summary"><div class="ink-summary-top"><span class="ink-rank">${String(index + 1).padStart(2, '0')}</span><span class="ink-name">${escapeHtml(name)}</span><strong>${count}<small> เครื่อง</small></strong></div><div class="ink-meter"><i style="width:${(count / maxInk) * 100}%"></i></div></article>`).join(''); document.querySelector('#departmentList').innerHTML = departments.slice(0, 6).map(([name, count], index) => `<div class="department-row"><span class="department-rank">${index + 1}</span><span>${escapeHtml(name)}</span><strong>${count} <small>รายการ</small></strong></div>`).join(''); document.querySelector('#modelList').innerHTML = modelGroups.map(group => `<tr><td>${escapeHtml(group.model)}</td><td><span class="model-type">${escapeHtml(group.ink)}</span></td><td><strong>${group.count}</strong></td></tr>`).join(''); }
async function syncGoogleSheet() {
  try {
    const items = await loadGoogleSheet();
    render(items);
    updateHospitalCount(items);
    if (status) {
      status.textContent = `ซิงค์จาก Google Sheets แล้ว • ${items.length} รายการ`;
      status.classList.remove('error');
    }
  } catch {
    if (status) {
      status.textContent = 'ยังซิงค์ Google Sheets ไม่ได้ — ตรวจสอบการตั้งค่าการแชร์ชีต';
      status.classList.add('error');
    }
  }
}

syncGoogleSheet();
// อัปเดตสถิติจาก Google Sheets ทุก 1 นาทีโดยอัตโนมัติ
setInterval(syncGoogleSheet, 60_000);

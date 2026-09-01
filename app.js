let items = [];

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

const body = document.querySelector('#inventoryBody');
const search = document.querySelector('#searchInput');
const departmentFilter = document.querySelector('#departmentFilter');
const buildingFilter = document.querySelector('#buildingFilter');
const floorFilter = document.querySelector('#floorFilter');
const modelFilter = document.querySelector('#modelFilter');
const assetFilter = document.querySelector('#assetFilter');
const empty = document.querySelector('#emptyState');
const result = document.querySelector('#resultText');
const total = document.querySelector('#totalCount');
const columns = ['unit','floor','department','model','serial','ink','asset','location'];
const columnLabels = { unit:'ตึก', floor:'ชั้น', department:'แผนก', model:'รุ่น-ยี่ห้อ', serial:'Serial Number (S/N)', ink:'หมึก', asset:'ครุภัณฑ์/ID', location:'ตำแหน่ง' };
const pageSize = 25;
let currentPage = 1;
let displayedItems = [];
const sheetUrl = 'https://docs.google.com/spreadsheets/d/1b_WvVvFsKd32XSO8w-_DKCOXCZVShKfF1G_umh9XCKo/gviz/tq?gid=1255614734&tqx=out:json';
const sheetWriteUrl = 'https://script.google.com/macros/s/AKfycbzQTPqz-udUL6CCUZdR1mxVM0SMNr9vWTBfda80rtd68cjtfE0AlLSpqc2zJ0hb1_Q99A/exec';
const syncStatus = document.querySelector('#syncStatus');
const editDialog = document.querySelector('#editDialog');
const editForm = document.querySelector('#editForm');
const editMessage = document.querySelector('#editMessage');
const addPrinterDialog = document.querySelector('#addPrinterDialog');
const addPrinterForm = document.querySelector('#addPrinterForm');
const addPrinterMessage = document.querySelector('#addPrinterMessage');
const addFieldIds = { unit:'addUnit', floor:'addFloor', department:'addDepartment', model:'addModel', serial:'addSerial', ink:'addInk', asset:'addAsset', location:'addLocation' };

function setLoading(isLoading) {
  document.body.classList.toggle('is-loading', isLoading);
  document.body.setAttribute('aria-busy', String(isLoading));
  if (isLoading) {
    body.innerHTML = '<tr class="table-loading-row"><td colspan="9"><span class="inline-spinner" aria-hidden="true"></span><span>กำลังโหลดข้อมูล</span></td></tr>';
  }
}

function options(select, values) { values.forEach(value => select.insertAdjacentHTML('beforeend', `<option>${value}</option>`)); }
function updateEditSuggestions() { const fields = { model:'modelSuggestions', ink:'inkSuggestions', location:'locationSuggestions' }; Object.entries(fields).forEach(([key, listId]) => { const list = document.querySelector(`#${listId}`); list.replaceChildren(...[...new Set(items.map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th', { numeric:true })).map(value => { const option = document.createElement('option'); option.value = value; return option; })); }); }
function uniqueAddValues(source, key) { return [...new Set(source.map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th', { numeric:true })); }
function setAddSelectOptions(select, values, placeholder, selected = '') { select.replaceChildren(Object.assign(document.createElement('option'), { value:'', textContent:placeholder }), ...values.map(value => Object.assign(document.createElement('option'), { value, textContent:value }))); if (values.includes(selected)) select.value = selected; }
function setAddDatalistOptions(id, values) { document.querySelector(`#${id}`).replaceChildren(...values.map(value => Object.assign(document.createElement('option'), { value }))); }
function refreshMoveDependentOptions(changed = 'unit', saved = null) { const unitSelect = document.querySelector('#editUnit'); const floorSelect = document.querySelector('#editFloor'); const departmentSelect = document.querySelector('#editDepartment'); if (changed === 'initial') setAddSelectOptions(unitSelect, uniqueAddValues(items, 'unit'), 'เลือกตึก', saved?.unit || unitSelect.value); const selectedUnit = unitSelect.value; const unitItems = selectedUnit ? items.filter(item => item.unit === selectedUnit) : []; const previousFloor = saved?.floor || floorSelect.value; setAddSelectOptions(floorSelect, uniqueAddValues(unitItems, 'floor'), selectedUnit ? 'เลือกชั้น' : 'เลือกตึกก่อน', changed === 'unit' && !saved ? '' : previousFloor); floorSelect.disabled = !selectedUnit; const selectedFloor = floorSelect.value; const scopedItems = selectedFloor ? unitItems.filter(item => item.floor === selectedFloor) : unitItems; const previousDepartment = saved?.department || departmentSelect.value; setAddSelectOptions(departmentSelect, uniqueAddValues(scopedItems, 'department'), selectedUnit ? 'เลือกแผนก' : 'เลือกตึกก่อน', (changed === 'unit' || changed === 'floor') && !saved ? '' : previousDepartment); departmentSelect.disabled = !selectedUnit; const selectedDepartment = departmentSelect.value; const detailItems = selectedDepartment ? scopedItems.filter(item => item.department === selectedDepartment) : scopedItems; setAddDatalistOptions('locationSuggestions', uniqueAddValues(detailItems, 'location')); }
function refreshAddDependentOptions(changed = 'unit') { const unitSelect = document.querySelector('#addUnit'); const floorSelect = document.querySelector('#addFloor'); const departmentSelect = document.querySelector('#addDepartment'); if (changed === 'initial') setAddSelectOptions(unitSelect, uniqueAddValues(items, 'unit'), 'เลือกตึก', unitSelect.value); const selectedUnit = unitSelect.value; const unitItems = selectedUnit ? items.filter(item => item.unit === selectedUnit) : []; const previousFloor = floorSelect.value; const floors = uniqueAddValues(unitItems, 'floor'); setAddSelectOptions(floorSelect, floors, selectedUnit ? 'เลือกชั้น' : 'เลือกตึกก่อน', changed === 'unit' ? '' : previousFloor); floorSelect.disabled = !selectedUnit; const selectedFloor = floorSelect.value; const scopedItems = selectedFloor ? unitItems.filter(item => item.floor === selectedFloor) : unitItems; const previousDepartment = departmentSelect.value; setAddSelectOptions(departmentSelect, uniqueAddValues(scopedItems, 'department'), selectedUnit ? 'เลือกแผนก' : 'เลือกตึกก่อน', changed === 'unit' || changed === 'floor' ? '' : previousDepartment); departmentSelect.disabled = !selectedUnit; const selectedDepartment = departmentSelect.value; const detailItems = selectedDepartment ? scopedItems.filter(item => item.department === selectedDepartment) : scopedItems; setAddDatalistOptions('addModelSuggestions', uniqueAddValues(detailItems, 'model')); setAddDatalistOptions('addInkSuggestions', uniqueAddValues(detailItems, 'ink')); setAddDatalistOptions('addLocationSuggestions', uniqueAddValues(detailItems, 'location')); }
function refreshDependentOptions(saved = null) { const selected = saved || { unit: buildingFilter.value, floor: floorFilter.value, department: departmentFilter.value, model: modelFilter.value }; const filters = { unit: buildingFilter, floor: floorFilter, department: departmentFilter, model: modelFilter }; const defaults = { unit: 'ทุกตึก', floor: 'ทุกชั้น', department: 'ทุกแผนก', model: 'ทุกรุ่น' }; Object.entries(filters).forEach(([key, select]) => { const values = [...new Set(items.filter(item => Object.entries(selected).every(([otherKey, value]) => otherKey === key || !value || item[otherKey] === value)).map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true })); select.innerHTML = `<option value="">${defaults[key]}</option>`; options(select, values); if (values.includes(selected[key])) select.value = selected[key]; }); }
options(departmentFilter, [...new Set(items.map(x => x.department))].sort());
options(buildingFilter, [...new Set(items.map(x => x.unit))].sort());
options(modelFilter, [...new Set(items.map(x => x.model))].sort());
refreshDependentOptions();

function render() {
  const query = search.value.trim().toLowerCase();
  const assetQuery = assetFilter.value.trim().toLowerCase();
  const shown = items.filter(item => (!departmentFilter.value || item.department === departmentFilter.value) && (!buildingFilter.value || item.unit === buildingFilter.value) && (!floorFilter.value || item.floor === floorFilter.value) && (!modelFilter.value || item.model === modelFilter.value) && (!assetQuery || item.asset.toLowerCase().includes(assetQuery)) && (!query || columns.map(key => item[key]).join(' ').toLowerCase().includes(query)));
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = shown.slice(start, start + pageSize);
  displayedItems = pageItems;
  body.innerHTML = pageItems.map(item => `<tr>${columns.map(key => `<td class="${key === 'asset' ? 'asset' : ''}" data-label="${columnLabels[key]}">${key === 'ink' ? `<span class="pill">${item[key] || '-'}</span>` : (item[key] || '—')}</td>`).join('')}<td class="row-action" data-label="ย้าย"><button class="edit-row-button" type="button" data-row="${item._rowNumber}" aria-label="ย้ายอุปกรณ์" title="ย้ายอุปกรณ์"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.5 3.5-2.2 0v5.2h5.2V8.5L22 12l-3.5 3.5v-2.2h-5.2v5.2h2.2L12 22l-3.5-3.5h2.2v-5.2H5.5v2.2L2 12l3.5-3.5v2.2h5.2V5.5H8.5L12 2Z"/></svg></button></td></tr>`).join('');
  total.textContent = items.length;
  result.textContent = `จำนวนรายการ ${shown.length}`;
  empty.hidden = shown.length !== 0;
  document.querySelector('#pagination').hidden = shown.length === 0;
  document.querySelector('#pageLabel').textContent = `หน้า ${currentPage} จาก ${totalPages}`;
  document.querySelector('#prevPage').disabled = currentPage === 1;
  document.querySelector('#nextPage').disabled = currentPage === totalPages;
}
function normaliseHeader(header) { return header.replace(/^\ufeff/, '').trim().toLowerCase(); }
function loadRows(rows) { const savedFilters = { search: search.value, department: departmentFilter.value, building: buildingFilter.value, floor: floorFilter.value, model: modelFilter.value, asset: assetFilter.value }; if (rows.length < 2) throw new Error('ไม่พบข้อมูลในไฟล์ CSV'); const header = rows[0].map(normaliseHeader); const aliases = { unit:['หน่วยงาน','ตึก','อาคาร'], floor:['ชั้น'], department:['แผนก'], model:['รุ่น-ยี่ห้อ','รุ่น','ยี่ห้อ'], asset:['ครุภัณฑ์/id','ครุภัณฑ์','id'], serial:['serial number (s/n)','serial number','serial','s/n','sn'], ink:['หมึก'], location:['ตำแหน่ง'] }; const index = Object.fromEntries(columns.map(key => [key, header.findIndex(value => aliases[key].includes(value))])); if (index.department < 0 || index.model < 0) throw new Error('ไม่พบคอลัมน์ “แผนก” หรือ “รุ่น-ยี่ห้อ” ในไฟล์'); items = rows.slice(1).map((row, rowIndex) => { const item = Object.fromEntries(columns.map(key => [key, index[key] < 0 ? '' : (row[index[key]] || '')])); item._rowNumber = rowIndex + 2; return item; }).filter(item => columns.some(key => item[key])); items.forEach(item => { if (!item.floor && ['100 y', '100y', 'OPD'].includes(item.unit)) item.floor = 'G'; }); refreshDependentOptions({ unit: savedFilters.building, floor: savedFilters.floor, department: savedFilters.department, model: savedFilters.model }); updateEditSuggestions(); refreshAddDependentOptions('initial'); assetFilter.value = savedFilters.asset; search.value = savedFilters.search; render(); }
function loadGoogleSheet() { return new Promise((resolve, reject) => { const timeout = setTimeout(() => { cleanup(); reject(new Error('หมดเวลารอข้อมูล')); }, 12000); const script = document.createElement('script'); const cleanup = () => { clearTimeout(timeout); script.remove(); delete window.receivePrinterData; }; window.receivePrinterData = response => { cleanup(); if (!response?.ok || !Array.isArray(response.values)) { reject(new Error(response?.error || 'รูปแบบข้อมูลไม่ถูกต้อง')); return; } resolve(response.values); }; script.src = `${sheetWriteUrl}?action=read&_=${Date.now()}`; script.onerror = () => { cleanup(); reject(new Error('โหลดข้อมูลไม่สำเร็จ')); }; document.head.append(script); }); }
async function syncGoogleSheet() { setLoading(true); try { loadRows(await loadGoogleSheet()); syncStatus.textContent = `ซิงค์จาก Google Sheets แล้ว • ${items.length} รายการ`; syncStatus.classList.remove('error'); } catch { render(); syncStatus.textContent = 'ยังซิงค์ Google Sheets ไม่ได้ — ตรวจสอบการตั้งค่าการแชร์ชีต'; syncStatus.classList.add('error'); } finally { setLoading(false); } }
async function downloadPdf() { const button = document.querySelector('#pdfButton'); if (!window.jspdf || !window.printerPdfFontData) { alert('ยังเตรียมระบบสร้าง PDF ไม่เสร็จ กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง'); return; } button.disabled = true; button.textContent = 'กำลังสร้าง PDF…'; try { pdfFontData ||= window.printerPdfFontData; const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); pdf.addFileToVFS('LeelawUI.ttf', pdfFontData); pdf.addFont('LeelawUI.ttf', 'LeelawUI', 'normal'); pdf.setFont('LeelawUI'); const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight(); const widths = [20, 12, 47, 50, 38, 28, 40, 42]; const headers = ['ตึก','ชั้น','แผนก','รุ่น-ยี่ห้อ','Serial Number (S/N)','หมึก','ครุภัณฑ์/ID','ตำแหน่ง']; const drawHeader = y => { let x = 10; pdf.setFillColor(36, 90, 76); pdf.rect(10, y, 277, 8, 'F'); pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); headers.forEach((header, index) => { pdf.text(header, x + 2, y + 5.3); x += widths[index]; }); return y + 8; }; pdf.setTextColor(23, 55, 47); pdf.setFontSize(16); pdf.text('ทะเบียนปริ้นเตอร์ทั้งหมด', 10, 13); pdf.setFontSize(9); pdf.text(`จำนวน ${displayedItems.length} รายการ`, 10, 19); let y = drawHeader(24); pdf.setFontSize(7); displayedItems.forEach((item, row) => { if (y + 8 > pageHeight - 10) { pdf.addPage(); y = drawHeader(10); pdf.setFontSize(7); } if (row % 2 === 1) { pdf.setFillColor(247, 251, 248); pdf.rect(10, y, 277, 8, 'F'); } let x = 10; columns.forEach((key, index) => { const value = String(item[key] || '—'); pdf.setTextColor(23, 55, 47); pdf.text(value, x + 2, y + 5.3, { maxWidth: widths[index] - 4 }); x += widths[index]; }); pdf.setDrawColor(220, 232,223); pdf.line(10, y + 8, 287, y + 8); y += 8; }); pdf.save('ทะเบียนปริ้นเตอร์ทั้งหมด.pdf'); } catch { alert('ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่อีกครั้ง'); } finally { button.disabled = false; button.textContent = 'ดาวน์โหลด PDF'; } }
[search, assetFilter].forEach(control => control.addEventListener('input', () => { currentPage = 1; render(); }));
[buildingFilter, floorFilter, departmentFilter, modelFilter].forEach(control => control.addEventListener('input', () => { currentPage = 1; refreshDependentOptions(); render(); }));
document.querySelector('#clearFilters').addEventListener('click', () => { currentPage = 1; search.value = ''; departmentFilter.value = ''; buildingFilter.value = ''; floorFilter.value = ''; modelFilter.value = ''; assetFilter.value = ''; refreshDependentOptions(); render(); });
document.querySelector('#prevPage').addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; render(); } });
document.querySelector('#nextPage').addEventListener('click', () => { currentPage += 1; render(); });
const editFields = { unit:'editUnit', floor:'editFloor', department:'editDepartment', model:'editModel', serial:'editSerial', ink:'editInk', asset:'editAsset', location:'editLocation' };
const moveFields = { unit:'editUnit', floor:'editFloor', department:'editDepartment', location:'editLocation' };
function closeEditDialog() { editDialog.close(); editMessage.textContent = ''; }
body.addEventListener('click', event => { const button = event.target.closest('.edit-row-button'); if (!button) return; const item = items.find(entry => entry._rowNumber === Number(button.dataset.row)); if (!item) return; document.querySelector('#editRowNumber').value = item._rowNumber; Object.entries(editFields).filter(([key]) => !['unit','floor','department'].includes(key)).forEach(([key, id]) => { document.querySelector(`#${id}`).value = item[key] || ''; }); refreshMoveDependentOptions('initial', item); editMessage.textContent = ''; editDialog.showModal(); });
document.querySelector('#editUnit').addEventListener('change', () => refreshMoveDependentOptions('unit'));
document.querySelector('#editFloor').addEventListener('change', () => refreshMoveDependentOptions('floor'));
document.querySelector('#editDepartment').addEventListener('change', () => refreshMoveDependentOptions('department'));
document.querySelector('#closeEdit').addEventListener('click', closeEditDialog);
document.querySelector('#cancelEdit').addEventListener('click', closeEditDialog);
editDialog.addEventListener('click', event => { if (event.target === editDialog) closeEditDialog(); });
editForm.addEventListener('submit', async event => { event.preventDefault(); if (!sheetWriteUrl) { editMessage.textContent = 'ยังไม่ได้ตั้งค่า URL ของ Google Apps Script'; editMessage.classList.add('error'); return; } const saveButton = document.querySelector('#saveEdit'); const payload = { rowNumber:Number(document.querySelector('#editRowNumber').value), values:Object.fromEntries(Object.entries(moveFields).map(([key,id]) => [key, document.querySelector(`#${id}`).value.trim()])) }; saveButton.disabled = true; saveButton.textContent = 'กำลังบันทึก…'; editMessage.classList.remove('error'); editMessage.textContent = ''; try { await fetch(sheetWriteUrl, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload) }); editMessage.textContent = 'บันทึกการย้ายแล้ว กำลังโหลดข้อมูลล่าสุด…'; await new Promise(resolve => setTimeout(resolve, 1400)); await syncGoogleSheet(); closeEditDialog(); } catch { editMessage.textContent = 'บันทึกไม่สำเร็จ กรุณาตรวจการเชื่อมต่อ Google Apps Script'; editMessage.classList.add('error'); } finally { saveButton.disabled = false; saveButton.textContent = 'บันทึกการย้าย'; } });
function closeAddPrinterDialog() { addPrinterDialog.close(); addPrinterMessage.textContent = ''; addPrinterMessage.classList.remove('error'); }
document.querySelector('#addUnit').addEventListener('change', () => refreshAddDependentOptions('unit'));
document.querySelector('#addFloor').addEventListener('change', () => refreshAddDependentOptions('floor'));
document.querySelector('#addDepartment').addEventListener('change', () => refreshAddDependentOptions('department'));
document.querySelector('#openAddPrinter').addEventListener('click', () => { addPrinterForm.reset(); refreshAddDependentOptions('initial'); addPrinterMessage.textContent = ''; addPrinterDialog.showModal(); requestAnimationFrame(() => document.querySelector('#addUnit').focus()); });
document.querySelector('#closeAddPrinter').addEventListener('click', closeAddPrinterDialog);
document.querySelector('#cancelAddPrinter').addEventListener('click', closeAddPrinterDialog);
addPrinterDialog.addEventListener('click', event => { if (event.target === addPrinterDialog) closeAddPrinterDialog(); });
addPrinterForm.addEventListener('submit', async event => { event.preventDefault(); const saveButton = document.querySelector('#saveAddPrinter'); const values = Object.fromEntries(Object.entries(addFieldIds).map(([key,id]) => [key, document.querySelector(`#${id}`).value.trim()])); saveButton.disabled = true; saveButton.textContent = 'กำลังเพิ่ม…'; addPrinterMessage.classList.remove('error'); addPrinterMessage.textContent = ''; try { await fetch(sheetWriteUrl, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({ action:'add', values }) }); addPrinterMessage.textContent = 'เพิ่มข้อมูลแล้ว กำลังโหลดข้อมูลล่าสุด…'; await new Promise(resolve => setTimeout(resolve, 1500)); await syncGoogleSheet(); closeAddPrinterDialog(); } catch { addPrinterMessage.textContent = 'เพิ่มข้อมูลไม่สำเร็จ กรุณาตรวจการเชื่อมต่อ Google Apps Script'; addPrinterMessage.classList.add('error'); } finally { saveButton.disabled = false; saveButton.textContent = 'เพิ่มข้อมูล'; } });
render();
syncGoogleSheet();
// ตรวจข้อมูลล่าสุดจาก Google Sheets ทุก 1 นาที โดยไม่ต้องรีเฟรชหน้าเว็บ
setInterval(syncGoogleSheet, 60_000);

let items = [];

const body = document.querySelector('#inventoryBody');
const search = document.querySelector('#searchInput');
const departmentFilter = document.querySelector('#departmentFilter');
const buildingFilter = document.querySelector('#buildingFilter');
const floorFilter = document.querySelector('#floorFilter');
const empty = document.querySelector('#emptyState');
const result = document.querySelector('#resultText');
const total = document.querySelector('#totalCount');
const columns = ['unit','floor','department','model','ink','location','asset','note'];
const pageSize = 25;
let currentPage = 1;
let displayedItems = [];
const sheetUrl = 'https://docs.google.com/spreadsheets/d/1b_WvVvFsKd32XSO8w-_DKCOXCZVShKfF1G_umh9XCKo/gviz/tq?gid=345504780&tqx=out:json';
const syncStatus = document.querySelector('#syncStatus');

function options(select, values) { values.forEach(value => select.insertAdjacentHTML('beforeend', `<option>${value}</option>`)); }
function refreshFloorOptions() { const selectedFloor = floorFilter.value; const availableFloors = [...new Set(items.filter(item => !buildingFilter.value || item.unit === buildingFilter.value).map(item => item.floor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true })); floorFilter.innerHTML = '<option value="">ทุกชั้น</option>'; options(floorFilter, availableFloors); if (availableFloors.includes(selectedFloor)) floorFilter.value = selectedFloor; }
options(departmentFilter, [...new Set(items.map(x => x.department))].sort());
options(buildingFilter, [...new Set(items.map(x => x.unit))].sort());
refreshFloorOptions();

function render() {
  const query = search.value.trim().toLowerCase();
  const shown = items.filter(item => (!departmentFilter.value || item.department === departmentFilter.value) && (!buildingFilter.value || item.unit === buildingFilter.value) && (!floorFilter.value || item.floor === floorFilter.value) && (!query || Object.values(item).join(' ').toLowerCase().includes(query)));
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = shown.slice(start, start + pageSize);
  displayedItems = pageItems;
  body.innerHTML = pageItems.map(item => `<tr>${columns.map(key => `<td class="${key === 'asset' ? 'asset' : ''}">${key === 'ink' ? `<span class="pill">${item[key] || '-'}</span>` : (item[key] || '—')}</td>`).join('')}</tr>`).join('');
  total.textContent = items.length;
  result.textContent = shown.length ? `แสดง ${start + 1}–${Math.min(start + pageSize, shown.length)} จาก ${shown.length} รายการ` : 'แสดง 0 รายการ';
  empty.hidden = shown.length !== 0;
  document.querySelector('#pagination').hidden = shown.length === 0;
  document.querySelector('#pageLabel').textContent = `หน้า ${currentPage} จาก ${totalPages}`;
  document.querySelector('#prevPage').disabled = currentPage === 1;
  document.querySelector('#nextPage').disabled = currentPage === totalPages;
}
function normaliseHeader(header) { return header.replace(/^\ufeff/, '').trim().toLowerCase(); }
function loadRows(rows) { if (rows.length < 2) throw new Error('ไม่พบข้อมูลในไฟล์ CSV'); const header = rows[0].map(normaliseHeader); const aliases = { unit:['หน่วยงาน','ตึก','อาคาร'], floor:['ชั้น'], department:['แผนก'], model:['รุ่น-ยี่ห้อ','รุ่น','ยี่ห้อ'], ink:['หมึก'], location:['ตำแหน่ง'], asset:['ครุภัณฑ์/id','ครุภัณฑ์','id'], note:['หมายเหตุ'] }; const index = Object.fromEntries(columns.map(key => [key, header.findIndex(value => aliases[key].includes(value))])); if (index.department < 0 || index.model < 0) throw new Error('ไม่พบคอลัมน์ “แผนก” หรือ “รุ่น-ยี่ห้อ” ในไฟล์'); items = rows.slice(1).map(row => Object.fromEntries(columns.map(key => [key, index[key] < 0 ? '' : (row[index[key]] || '')]))).filter(item => Object.values(item).some(Boolean)); items.forEach(item => { if (!item.floor && ['100 y', '100y', 'OPD'].includes(item.unit)) item.floor = 'G'; }); departmentFilter.innerHTML = '<option value="">ทุกแผนก</option>'; buildingFilter.innerHTML = '<option value="">ทุกตึก</option>'; options(departmentFilter, [...new Set(items.map(x => x.department).filter(Boolean))].sort()); options(buildingFilter, [...new Set(items.map(x => x.unit).filter(Boolean))].sort()); refreshFloorOptions(); search.value = ''; render(); }
function loadGoogleSheet() { return new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('หมดเวลารอข้อมูล')), 12000); window.google = window.google || {}; window.google.visualization = window.google.visualization || {}; window.google.visualization.Query = window.google.visualization.Query || {}; window.google.visualization.Query.setResponse = response => { clearTimeout(timeout); script.remove(); const headers = response.table.cols.map(column => column.label || ''); const rows = response.table.rows.map(row => row.c.map(cell => cell ? String(cell.f || cell.v || '').trim() : '')); resolve([headers, ...rows]); }; const script = document.createElement('script'); script.src = sheetUrl; script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('โหลดข้อมูลไม่สำเร็จ')); }; document.head.append(script); }); }
async function syncGoogleSheet() { try { loadRows(await loadGoogleSheet()); syncStatus.textContent = `ซิงค์จาก Google Sheets แล้ว • ${items.length} รายการ`; syncStatus.classList.remove('error'); } catch { syncStatus.textContent = 'ยังซิงค์ Google Sheets ไม่ได้ — ตรวจสอบการตั้งค่าการแชร์ชีต'; syncStatus.classList.add('error'); } }
async function downloadPdf() { const button = document.querySelector('#pdfButton'); if (!window.jspdf || !window.printerPdfFontData) { alert('ยังเตรียมระบบสร้าง PDF ไม่เสร็จ กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง'); return; } button.disabled = true; button.textContent = 'กำลังสร้าง PDF…'; try { pdfFontData ||= window.printerPdfFontData; const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); pdf.addFileToVFS('LeelawUI.ttf', pdfFontData); pdf.addFont('LeelawUI.ttf', 'LeelawUI', 'normal'); pdf.setFont('LeelawUI'); const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight(); const widths = [23, 13, 50, 55, 28, 42, 30, 34]; const headers = ['ตึก','ชั้น','แผนก','รุ่น-ยี่ห้อ','หมึก','ตำแหน่ง','ครุภัณฑ์/ID','หมายเหตุ']; const drawHeader = y => { let x = 10; pdf.setFillColor(36, 90, 76); pdf.rect(10, y, 277, 8, 'F'); pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); headers.forEach((header, index) => { pdf.text(header, x + 2, y + 5.3); x += widths[index]; }); return y + 8; }; pdf.setTextColor(23, 55, 47); pdf.setFontSize(16); pdf.text('ทะเบียนปริ้นเตอร์ทั้งหมด', 10, 13); pdf.setFontSize(9); pdf.text(`จำนวน ${displayedItems.length} รายการ`, 10, 19); let y = drawHeader(24); pdf.setFontSize(7); displayedItems.forEach((item, row) => { if (y + 8 > pageHeight - 10) { pdf.addPage(); y = drawHeader(10); pdf.setFontSize(7); } if (row % 2 === 1) { pdf.setFillColor(247, 251, 248); pdf.rect(10, y, 277, 8, 'F'); } let x = 10; columns.forEach((key, index) => { const value = String(item[key] || '—'); pdf.setTextColor(23, 55, 47); pdf.text(value, x + 2, y + 5.3, { maxWidth: widths[index] - 4 }); x += widths[index]; }); pdf.setDrawColor(220, 232, 223); pdf.line(10, y + 8, 287, y + 8); y += 8; }); pdf.save('ทะเบียนปริ้นเตอร์ทั้งหมด.pdf'); } catch { alert('ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่อีกครั้ง'); } finally { button.disabled = false; button.textContent = 'ดาวน์โหลด PDF'; } }
[search, departmentFilter, floorFilter].forEach(control => control.addEventListener('input', () => { currentPage = 1; render(); }));
buildingFilter.addEventListener('input', () => { currentPage = 1; refreshFloorOptions(); render(); });
document.querySelector('#clearFilters').addEventListener('click', () => { currentPage = 1; search.value = ''; departmentFilter.value = ''; buildingFilter.value = ''; refreshFloorOptions(); render(); });
document.querySelector('#prevPage').addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; render(); } });
document.querySelector('#nextPage').addEventListener('click', () => { currentPage += 1; render(); });
render();
syncGoogleSheet();
// ตรวจข้อมูลล่าสุดจาก Google Sheets ทุก 1 นาที โดยไม่ต้องรีเฟรชหน้าเว็บ
setInterval(syncGoogleSheet, 60_000);

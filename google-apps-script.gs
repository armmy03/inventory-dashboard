const SPREADSHEET_ID = '1b_WvVvFsKd32XSO8w-_DKCOXCZVShKfF1G_umh9XCKo';
const SHEET_NAME = 'รวม';
const REPAIR_SHEET_NAME = 'ประวัติการซ่อม';

const FIELD_ALIASES = {
  unit: ['หน่วยงาน', 'ตึก', 'อาคาร'],
  floor: ['ชั้น'],
  department: ['แผนก'],
  model: ['รุ่น-ยี่ห้อ', 'รุ่น', 'ยี่ห้อ'],
  serial: ['serial number (s/n)', 'serial number', 'serial', 's/n', 'sn'],
  ink: ['หมึก'],
  asset: ['ครุภัณฑ์/id', 'ครุภัณฑ์', 'id'],
  location: ['ตำแหน่ง']
};

function doGet(e) {
  const isRepairHistory = Boolean(e && e.parameter && e.parameter.action === 'repairHistory');
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (isRepairHistory) return repairHistoryResponse(spreadsheet, e.parameter);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('ไม่พบชีตที่กำหนด');

    const values = sheet.getDataRange().getDisplayValues();
    return javascriptResponse({ ok: true, values });
  } catch (error) {
    const response = { ok: false, error: String(error.message || error) };
    return isRepairHistory ? repairJavascriptResponse(response) : javascriptResponse(response);
  }
}

function repairHistoryResponse(spreadsheet, params) {
  const sheet = spreadsheet.getSheetByName(REPAIR_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return repairJavascriptResponse({ ok: true, records: [] });
  const rows = sheet.getDataRange().getDisplayValues();
  const headers = rows[0].map(value => String(value).trim().toLowerCase());
  const find = names => headers.findIndex(header => names.includes(header));
  const indexes = { row:find(['แถวรายการ']), serial:find(['serial number (s/n)']), asset:find(['ครุภัณฑ์/id']), date:find(['วันที่แจ้งซ่อม']), symptom:find(['อาการเครื่อง']), method:find(['วิธีการซ่อม']) };
  const wantedRow = String(params.rowNumber || '').trim();
  const wantedSerial = String(params.serial || '').trim();
  const wantedAsset = String(params.asset || '').trim();
  const matches = row => (wantedSerial && indexes.serial >= 0 && row[indexes.serial] === wantedSerial) || (wantedAsset && indexes.asset >= 0 && row[indexes.asset] === wantedAsset) || (wantedRow && indexes.row >= 0 && row[indexes.row] === wantedRow);
  const records = rows.slice(1).filter(matches).map(row => ({ repairDate:indexes.date < 0 ? '' : row[indexes.date], symptom:indexes.symptom < 0 ? '' : row[indexes.symptom], method:indexes.method < 0 ? '' : row[indexes.method] })).reverse();
  return repairJavascriptResponse({ ok: true, records });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const payload = JSON.parse(e.postData.contents || '{}');
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (payload.action === 'repair') return appendRepairRecord(spreadsheet, payload);
    const rowNumber = Number(payload.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber < 2) throw new Error('เลขแถวไม่ถูกต้อง');

    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('ไม่พบชีตที่กำหนด');
    if (rowNumber > sheet.getLastRow()) throw new Error('ไม่พบแถวที่ต้องการแก้ไข');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
      .map(value => String(value).trim().toLowerCase());

    Object.entries(payload.values || {}).forEach(([key, value]) => {
      const aliases = FIELD_ALIASES[key];
      if (!aliases) return;
      const columnIndex = headers.findIndex(header => aliases.includes(header));
      if (columnIndex < 0) return;
      const cell = sheet.getRange(rowNumber, columnIndex + 1);
      if (key === 'serial' || key === 'asset') cell.setNumberFormat('@');
      cell.setValue(String(value ?? '').trim());
    });

    SpreadsheetApp.flush();
    return jsonResponse({ ok: true, rowNumber });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

function appendRepairRecord(spreadsheet, payload) {
  const device = payload.device || {};
  const repair = payload.repair || {};
  if (!String(repair.repairDate || '').trim()) throw new Error('กรุณาระบุวันที่แจ้งซ่อม');
  if (!String(repair.symptom || '').trim()) throw new Error('กรุณาระบุอาการเครื่อง');
  if (!String(repair.method || '').trim()) throw new Error('กรุณาระบุวิธีการซ่อม');
  const sheet = ensureRepairSheet(spreadsheet);
  sheet.appendRow([new Date(), Number(payload.rowNumber) || '', device.unit || '', device.floor || '', device.department || '', device.model || '', device.serial || '', device.asset || '', device.location || '', repair.repairDate || '', repair.symptom || '', repair.method || '']);
  return jsonResponse({ ok: true, rowNumber: sheet.getLastRow() });
}

function setupRepairSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ensureRepairSheet(spreadsheet).getName();
}

function ensureRepairSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(REPAIR_SHEET_NAME);
  if (sheet) return sheet;

  const headers = ['วันที่บันทึก', 'แถวรายการ', 'ตึก', 'ชั้น', 'แผนก', 'รุ่น-ยี่ห้อ', 'Serial Number (S/N)', 'ครุภัณฑ์/ID', 'ตำแหน่ง', 'วันที่แจ้งซ่อม', 'อาการเครื่อง', 'วิธีการซ่อม'];
  sheet = spreadsheet.insertSheet(REPAIR_SHEET_NAME);
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  return sheet;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function javascriptResponse(data) {
  return ContentService.createTextOutput(
    `window.receivePrinterData(${JSON.stringify(data)});`
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function repairJavascriptResponse(data) {
  return ContentService.createTextOutput(
    `window.receiveRepairHistory(${JSON.stringify(data)});`
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

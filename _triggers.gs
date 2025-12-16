const testOnAnySheetAnyCellEditTrigger = () => {
  const sheetName = investmentOverviewChartsSheet().getSheetName();
  const cellAddress = 'E5';

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const range = sheet.getRange(cellAddress);

  onAnySheetAnyCellEdit({range});
}

// We need to use static sheet names and ranges here as this method is 
// called on every single edit on the ENTIRE spreadsheet
const onAnySheetAnyCellEditHandlerMap = {
  'Investment Overview Charts': {
    'C3:M10': (params) => {
      const {range} = params;
      const {periodPicker} = investmentOverviewChartsSheet().getMagicCoordinates();
      if (rangeArrayIncludes([periodPicker.col, periodPicker.row], range.getColumn(), range.getRow())) {
        investmentOverviewChartsSheet().onTimePeriodChange(params);
      }
    }
  }
};

/**
 * Triggers every time a cell is edited in the spreadsheet.
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e The edit event object.
 */
const onAnySheetAnyCellEdit = (e) => {
  
  const editedRange = e.range;
  const sheet = editedRange.getSheet();
  const sheetName = sheet.getName();

  if (!onAnySheetAnyCellEditHandlerMap[sheetName]) {
    return;
  }
  
  const a1 = editedRange.getA1Notation();
  const section = onAnySheetAnyCellEditHandlerMap[sheetName];

  if (section[a1]) {
    section[a1]({sheet, range: editedRange});
    return;
  }
  
  const col = editedRange.getColumn();
  const row = editedRange.getRow();

  Object.keys(section).forEach(key => {
    if (!key.includes(':')) {
      return;
    }

    if (rangeArrayIncludes(a1ToArray(key), col, row)) {
      section[key]({sheet, range: editedRange});
    }
  })
};
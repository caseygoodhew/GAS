// Requires that the first 2 rows of a sheet represent the labelled columns
// [1] | COL_NAMES | IN_CAMEL_UPPER |
// [2] | Col Names | In Friendly Case |
const initLabelledColumns = (sheet, expectedLabels) => {

  const sheetName = sheet.getSheetName();

  const columns = expectedLabels.reduce((o, v) => {
    o[v] = v;
    return o;
  }, {});

  const rowValues = sheet.getRange(1, 1, 2, sheet.getDataRange().getNumColumns()).getValues();
  // internal
  const labelRowValues = rowValues[0];
  const headingRowValues = rowValues[1];

  // returned
  const colLabelToNumMap = {};
  const colNumToLabelMap = {};
  const colHeadingsMap = {};

  labelRowValues.forEach((key, index) => {
    if (columns[key]) {
      colLabelToNumMap[key] = index + 1;
      colNumToLabelMap[index + 1] = key;
      colHeadingsMap[key] = headingRowValues[index];
    }
  });

  const missingColumns = Object.keys(columns).filter(key => !colLabelToNumMap[key]);

  if (missingColumns.length !== 0) {
    throw new Error(`Missing labeled columns ['${missingColumns.join(', ')}'] in sheet '${sheetName}'`)
  }

  const columnIndicies = Object.values(colLabelToNumMap);

  return {
    ...columns,
    colNumToLabelMap,
    colLabelToNumMap,
    keys: Object.keys(columns),
    first: Math.min(...columnIndicies),
    last: Math.max(...columnIndicies),
    headingMap: colHeadingsMap
  };
}

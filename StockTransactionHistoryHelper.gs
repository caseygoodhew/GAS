function fillEventIdsForTrading212TransactionsRaw() {
  fillEventIds({
    sheetName: 'Trading 212 Transactions Raw',
    firstRow: 2,
    eventIdCol: "A",
    contentsCol: "B"
  });
}

function fillEventIdsForCharlesSchwabTransactionsRaw() {
  fillEventIds({
    sheetName: 'Charles Schwab Transactions Raw',
    firstRow: 2,
    eventIdCol: "A",
    contentsCol: "C"
  });
}

function fillEventIds({ sheetName, firstRow, eventIdCol, contentsCol }) {
  
  const helper = makeHelper(sheetName);
  const sheet = helper.getSheet();

  const eventIdColNum = helper.resolveToColNum(eventIdCol);
  const contentsColNum = helper.resolveToColNum(contentsCol);

  if (!eventIdColNum) {
    throw new Error('Could not resolve eventIdColNum processing ' + eventIdCol)
  }

  if (!contentsColNum) {
    throw new Error('Could not resolve contentsColNum processing ' + contentsCol)
  }

  const eventIdRange = sheet.getRange(firstRow, eventIdColNum, sheet.getDataRange().getNumRows(), 1);
  const contentsRange = sheet.getRange(firstRow, contentsColNum, sheet.getDataRange().getNumRows(), 1);

  const eventIds = eventIdRange.getValues();
  const contents = contentsRange.getValues();

  for (let i = 0; i < contents.length; i++) {
    if (contents[i][0].trim().length > 0 && eventIds[i][0].trim().length === 0) {
      const cell = eventIdRange.getCell(i+1, 1);
      cell.setValue(makeEventId());
    }
  }
}

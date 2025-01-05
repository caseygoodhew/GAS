const dataRangeCellUpdater = (cellRef) => {
  const triggerOnEventName = 'complete';
  const myKey = '__dataRange';
  return {
    [myKey]: {
      cell: cellRef,
      onEvent: (eventName, updater, { dataRange }) => {
        if (eventName !== triggerOnEventName) {
          return;
        }

        const fromA1 = toA1Notation(dataRange.getColumn(), dataRange.getRow());
        const toA1 = toA1Notation(
          dataRange.getColumn() + dataRange.getNumColumns() - 1, 
          dataRange.getRow() + dataRange.getNumRows() - 1
        );
        
        updater.updateOne(myKey, `${fromA1}:${toA1}`);
      }
    }
  }
} 


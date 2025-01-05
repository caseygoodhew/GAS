const cellUpdater_finalValidationStatusWithCheckSumComparator = (cellRef, checkSumCellRef, realtimeCheckSumCellRef) => {
  const triggerOnEventName = 'complete';
  const myKey = '__checksum';
  return {
    [myKey]: {
      cell: cellRef,
      setter: 'setFormula',
      onEvent: (eventName, updater, { message }) => {
        if (eventName !== triggerOnEventName) {
          return;
        }

        const a1_left = toA1Notation(checkSumCellRef.col, checkSumCellRef.row);
        const a1_right = toA1Notation(realtimeCheckSumCellRef.col, realtimeCheckSumCellRef.row);

        const formula = `=if(${a1_left}=${a1_right}, "${message ?? 'OK!'}", "Data has changed since you last ran Validate")`;

        updater.updateOne(myKey, formula);
      }
    }
  }
} 

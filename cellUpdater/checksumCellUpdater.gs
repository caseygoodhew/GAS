const checksumCellUpdater = (cellRef) => {
  const triggerOnEventName = 'complete';
  const myKey = '__checksum';
  return {
    [myKey]: {
      cell: cellRef,
      onEvent: (eventName, updater, { dataRange }) => {
        if (eventName !== triggerOnEventName) {
          return;
        }

        updater.updateOne(myKey, CHECKSUM(dataRange.getValues()));
      }
    }
  }
} 

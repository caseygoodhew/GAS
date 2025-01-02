const timestampCellUpdater = (cellRef) => {
  const triggerOnEventName = 'complete';
  const myKey = '__timestamp';
  return {
    [myKey]: {
      cell: cellRef,
      onEvent: ({eventName, updater}) => {
        if (eventName !== triggerOnEventName) {
          return;
        }

        updater.updateOne(myKey, new Date());
      }
    }
  }
} 
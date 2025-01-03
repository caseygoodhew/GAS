const durationCellUpdater = (cellRef) => {
  const beginOnEventName = 'init';
  const completeOnEventName = 'complete';
  const myKey = '__duration';

  let startedAt = new Date();

  return {
    [myKey]: {
      cell: cellRef,
      onEvent: (eventName, updater) => {
        if (![beginOnEventName, completeOnEventName].includes(eventName)) {
          return;
        }

        if (eventName === beginOnEventName) {
          timer = new Date();
        } else if (eventName === completeOnEventName) {
          updater.updateOne(myKey, `${Math.round((new Date() - startedAt)/100)/10}s`);
        }
      }
    }
  }
} 
const cellUpdater_clearAllOnInit = () => {
  const triggerOnEventName = 'initialize';
  const myKey = '__clearAllOnInit';
  return {
    [myKey]: {
      cell: false,
      onEvent: (eventName, updater) => {
        if (eventName !== triggerOnEventName) {
          return;
        }

        updater.clearAll();
      }
    }
  }
} 

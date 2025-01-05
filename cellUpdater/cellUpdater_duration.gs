const cellUpdater_duration = (cellRef) => {
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
          startedAt = new Date();
        } else if (eventName === completeOnEventName) {
          const time = {};
          let seconds = (new Date() - startedAt)/1000;

          if (seconds < 60) {
            time.seconds = Math.round(seconds * 10)/10;
          } else {
            seconds = Math.round(seconds);
            time.minutes = Math.floor(seconds / 60);
            time.seconds = seconds - (time.minutes * 60);
          }
          
          const parts = [];

          if (time.minutes) {
            parts.push(`${time.minutes}m`);
          }

          parts.push(`${time.seconds}s`);
          
          updater.updateOne(myKey, parts.join(' '));
        }
      }
    }
  }
} 
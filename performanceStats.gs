const performanceStats = (config) => {
  
  const { helper, datestampCell, elapsedTimeCell } = (config || {});

  if (!helper && (datestampCell || elapsedTimeCell)) {
    throw new Error(`Cell references passed without suppling the helper for the sheet`)
  }

  if (datestampCell && (datestampCell.row == null || datestampCell.col == null)) {
    throw new Error(`Expected datestampCell to have "col" and "row" properties`);
  }

  if (elapsedTimeCell && (elapsedTimeCell.row == null || elapsedTimeCell.col == null)) {
    throw new Error(`Expected elapsedTimeCell to have "col" and "row" properties`);
  }
  
  let startTime;
  let endTime;

  const optionsWithTime = {
    year: 'numeric',
    month: 'short',     // Abbreviated month (e.g., 'Dec')
    day: 'numeric',
    hour: '2-digit',    // Two-digit hour (e.g., '05')
    minute: '2-digit',  // Two-digit minute (e.g., '18')
    hour12: false        // Use 12-hour clock with AM/PM
  };

  const calcElapsed = (date1, date2) => {
    const valueOf1 = date1.valueOf();
    const valueOf2 = date2.valueOf();
    const elapsedTime = Math.max(valueOf1, valueOf2) - Math.min(valueOf1, valueOf2);
    return { 
      value: elapsedTime,
      toString: () => `${Math.round(elapsedTime/1000)}s`
    }
  }
  
  const funcs = {
    start: () => {
      if (startTime != null) {
        throw new Error(`Already started`)
      }

      startTime = new Date();

      return funcs;
    },

    stop: () => {
      if (startTime == null) {
        throw new Error(`Stop called before start`)
      }

      if (endTime != null) {
        throw new Error(`Already stopped`)
      }

      endTime = new Date();

      const elapsedTime = calcElapsed(startTime, endTime);

      if (datestampCell) {
        helper.getRange(
          datestampCell.col, datestampCell.row
        ).setValue(
          endTime.toLocaleDateString('en-GB', optionsWithTime)
        )
      }

      if (elapsedTimeCell) {
        helper.getRange(
          elapsedTimeCell.col, elapsedTimeCell.row
        ).setValue(elapsedTime.toString());
      }

      return {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        elapsedTime
      }
    },

    reset: () => {
      startTime = null;
    },

    check: () => {
      if (startTime == null) {
        return {};
      } else if (endTime == null) {
        return calcElapsed(startTime, new Date());
      } else {
        return calcElapsed(startTime, endTime);
      }
    },

    log: (label) => {
      label = label == null ? 'Performance' : label;
      if (label.length) {
        label += ': ';
      }

      if (startTime == null) {
        console.log(`${label}Not yet started`);
      } else if (endTime == null) {
        console.log(`${label}${calcElapsed(startTime, new Date()).toString()} elapsed (still running)`);
      } else {
        console.log(`${label}${calcElapsed(startTime, endTime).toString()} elapsed (complete)`);
      }
    }
  }

  return funcs;
}

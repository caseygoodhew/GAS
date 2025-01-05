const initCellUpdater = (() => {
  const cellConfig = (resolvedCell, cellMapItem, name) => {
    
    let makeSetter;

    if (cellMapItem.setter == null) {
      makeSetter = (cell) => cell.setValue;
    } else if (typeof cellMapItem.setter === 'string') {
      if (typeof resolvedCell[cellMapItem.setter] === 'function') {
        makeSetter = (cell) => cell[cellMapItem.setter];
      } else {
        throw new Error(`Where the setter is a string, it must the name of a function of a cell (range). Got '${cellMapItem.setter} while processing '${name}''`);
      }
    } else if (typeof cellMapItem.setter === 'function') { 
      makeSetter = cellMapItem.setter;
    } else {
      throw new Error(`Unexpected typeof setter === '${typeof cellMapItem.setter}' while processing '${name}`);
    }

    if (cellMapItem.onEvent != null && typeof cellMapItem.onEvent !== 'function') {
      throw new Error(`Expected onEvent to be undefined or a function. Got '${typeof cellMapItem.onEvent}' while processing '${name}`);
    }
    
    return {
      cell: resolvedCell,
      formatter: cellMapItem.formatter ?? (v => v),
      setter: makeSetter(resolvedCell),
      onEvent: cellMapItem.onEvent ?? (() => {})
    }
  }

  const resolveCells = (sheet, cellMap) => {
    
    return Object.keys(cellMap).reduce((object, key) => {
      const fn = () => {
        const cell = cellMap[key].cell ?? cellMap[key];

        if (cell === false) {
          // if the cell is explicitly false, we'll mock it as this is an event-only condition
          return cellConfig({ setValue: () => {} }, cellMap[key])
        }
        
        if (cell == null) {
          throw new Error(`Cell with key ${key} is nullish and cannot be resolved`)
        }

        // an actual cell
        if (isRange(cell)) {
          return cellConfig(cell, cellMap[key]);
        }

        // row / column num
        if (typeof cell.row === 'number' && typeof cell.col === 'number') {
          return cellConfig(sheet.getRange(cell.row, cell.col), cellMap[key]);
        }

        // assume that it's a range that can be understood by sheet
        try {
          return cellConfig(sheet.getRange(cell), cellMap[key]);
        } catch (e) {
          throw new Error(`Tried to resolve cell with value '${cell}', but caught exception with message'${e.message}'`);
        }
      }

      object[key] = fn();
      return object;
    }, {});
  }

  return (sheet, cellMap) => { 
    
    cellMap = resolveCells(sheet, cellMap);

    const fns = {
      clearAll: () => {
        Object.keys(cellMap).forEach(key => fns.clearOne(key));
      },

      clearOne: (key) => {
        fns.updateOne(key, '');
      },
      
      update: (map) => {
        Object.keys(map).forEach(key => {
          fns.updateOne(key, map[key]);
        });
      },

      updateOne: (key, value) => {
        if (!cellMap[key]) {
          throw new Error(`Could not find declared cell with label ${key}`);
        }

        const formatted = cellMap[key].formatter(value);

        const valueToLog = typeof value === 'string' ? value : (typeof formatted === 'string' ? formatted : formatted.toString());

        console.log(`${key}: ${valueToLog}`);

        cellMap[key].setter(formatted);
      },

      event: (eventName, args) => {
        if (args != null && typeof args !== 'object') {
          throw new Error(`Expected event args to either be undefined or an object, got '${typeof args}'`)
        }
        
        Object.keys(cellMap).forEach(key => {
          cellMap[key].onEvent(eventName, fns, args ?? {});
        })
      }
    }

    fns.event('initialize')

    return fns;
  }
})();
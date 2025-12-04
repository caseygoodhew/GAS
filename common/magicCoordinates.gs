const initMagicCoordinates = (() => {
  
  const validateValue = (value, key, label) => {
    if (value == null) {
      throw new Error(`Expected to find magic coordinate with label "${key}" and ${label} value defined`);
    }

    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`Expected to find magic coordinate with label "${key}" and ${label} value defined as a number (got '${value}')`);
    }
  }
  
  const validateMagicCoordinateHasRowAndCol = (magicCoordinates, key) => {
    if (!magicCoordinates[key]) {
      throw new Error(`Expected to find magic coordinate with label "${key}"`);
    }

    validateValue(magicCoordinates[key].row, key, 'row');

    if (magicCoordinates[key].hasCol) {
      validateValue(magicCoordinates[key].col, key, 'col');
    }
  }

  const getKeys = (inKey) => {
    if (typeof inKey === 'string') {
      return [[inKey, inKey]];
    }

    if (typeof inKey !== 'object') {
      throw new Error(`Expected key to be either a string or an object, got '${typeof inKey}'`);
    }

    return Object.keys(inKey).map(key => [key, inKey[key]]);
  }

  return (range, ...keySets) => {
    const magicCoordinates = {};
    // e.g. {lastRun[13,4]}
    const re = /{([a-z]+)\[([0-9]+)(,([0-9]+))*\]}/i;

    const targetValues = range.getValues().flat();

    targetValues.forEach((value) => {
      if (!isString(value)) {
        return;
      }
      
      const match = value.match(re);
      if (match) {
        magicCoordinates[match[1]] = {
          hasCol: match[4] != null,
          row: parseInt(match[2], 10),
          col: match[4] == null ? undefined : parseInt(match[4], 10),
        }
      }
    });

    // Input: an array of keySets
    //    e.g: ['key1', 'key2']
    //    e.g.: { nameOnSheet: 'nameOnReturnObject' }
    //    e.g.: ['key1', { nameOnSheet: 'nameOnReturnObject' }]
    
    // Returns: an array of value maps with the same number of elements as the Input array
    //    e.g.: [{ 
    //            key1: { row: 1, col: 1 },
    //            key2: { row: 1, col: 1 }
    //          }, {
    //            nameOnReturnObject: { row: 1, col: 1 } 
    //          }, {
    //            key1: { row: 1, col: 1 }, 
    //            nameOnReturnObject: { row: 1, col: 1 } 
    //          }] 
    return keySets.map(keySet => (Array.isArray(keySet) ? keySet : [keySet]).reduce((obj, inKey) => {
        const allKeys = getKeys(inKey);
        allKeys.forEach(keys => {
          const [mcKey, outKey] = keys;
          validateMagicCoordinateHasRowAndCol(magicCoordinates, mcKey);
          obj[outKey] = {
            row: magicCoordinates[mcKey].row,
            col: magicCoordinates[mcKey].col
          };
        })
        return obj;
    }, {}));
  }
})();
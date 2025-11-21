const csthValidateTotalsAreEquivalentDebug = () => {
  execCSTH();
}

const csthValidateTotalsAreEquivalent = (csthColumns, constants) => {
    
  const {
    QUANTITY,
    FEES,
    AMOUNT
  } = csthColumns;

  if (!isString(QUANTITY)) {
    throw new Error(`Are you sure that you passed the correct parameters?`)
  }

  const getDefaultConfig = () => {
    return {
      props: [QUANTITY, FEES, AMOUNT],
      filter: () => true,
      marginOfError: 1
    };
  }

  const applyDefaults = config => {
    const defaultConfig = getDefaultConfig();
    
    if (config == null) {
      return defaultConfig;
    }

    if (!isObject(config)) {
      throw new Error(`Expected config to be a pure object, got ${typeof config} (${config})`);
    }

    return Object.keys(config).reduce((conf, key) => {
      conf[key] = config[key];
      return conf;
    }, defaultConfig);
  }

  const exec = (context, dataSet1, dataSet2, config) => {
    if (!isArray(dataSet1)) {
      throw new Error(`Expected dataSet1 to be an array, got ${typeof dataSet1}`);
    }

    if (!isArray(dataSet2)) {
      throw new Error(`Expected dataSet1 to be an array, got ${typeof dataSet2}`);
    }
    
    const { props, filter, marginOfError } = applyDefaults(config);

    const ds1 = dataSet1.filter(filter);
    const ds2 = dataSet2.filter(filter);

    props.forEach(prop => {
      const ds1Sum = sumProp(ds1, prop);
      const ds2Sum = sumProp(ds2, prop);

      if (!equalsPlusOrMinus(ds1Sum, ds2Sum, marginOfError)) {
        throw new Error(`[${context}] Sum of [${prop}]s are not equal. ${numberWithCommas(ds1Sum)} vs ${numberWithCommas(ds2Sum)} (diff of ${numberWithCommas(Math.abs(ds1Sum - ds2Sum))})`);
      }
    }); 
  }

  return exec;
}

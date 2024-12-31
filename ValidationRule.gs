const RULE_TYPE = { CELL: 'CELL', ROW: 'ROW', COLUMN: 'COLUMN' };
const RULE_LEVEL = { ERROR: 'ERROR', WARNING: 'WARNING', GOOD: 'GOOD', DIM: 'DIM' };
const MESSAGE_TARGET = { COMMENT: 'COMMENT' };

const configValidationRule = (config, func) => {

  if (typeof config !== 'object') {
    throw new Error(`Expected first argument (config) to be an object, got type of "${typeof config}"`);
  }

  if (typeof func !== 'function') {
    throw new Error(`Expected second argument (func) to be a function, got type of "${typeof func}"`);
  }

  const configValidator = (config) => {
    const assertExists = (property) => {
      if (config[property] == null) {
        throw new Error(`Expected config property "${property}" to be defined`);
      }
    }

    const assertIsOneOf = (value, options) => {
      const arr = Array.isArray(options) ? options : Object.values(options);
      
      if (!arr.includes(value)) {
        throw new Error(`Expected "${value}" to be included in ["${arr.join('", "')}"]`);
      }
    }

    const require = (property, options) => {
      assertExists(property);
      if (options) {
        assertIsOneOf(config[property], options);
      }
      return config[property];
    }

    const optional = (property, options) => {
      if (config[property] == null) {
        return null;
      }

      assertIsOneOf(config[property], options);
      return config[property];
    }
    
    const configValidators = {
      [RULE_TYPE.CELL]: (config) => {
        return {
          ...config,
          name: require('name'),
          level: require('level', RULE_LEVEL),
          messageTarget: optional('messageTarget', MESSAGE_TARGET) ?? MESSAGE_TARGET.COMMENT,
          targetCol: require('targetCol')
        }
      },

      [RULE_TYPE.ROW]: (config) => {
        return {
          ...config,
          name: require('name'),
          level: require('level', RULE_LEVEL)
        }
      },

      [RULE_TYPE.COL]: (config) => {
        return {
          ...config,
          name: require('name'),
          level: require('level', RULE_LEVEL),
          targetCol: require('targetCol')
        }
      }
    };
    
    const fn = configValidators[config.type] ?? (({ type }) => {
      throw new Error(`Unhandled validation rule type ${type}`);
    });

    return fn(config);
  };

  const validatedConfig = configValidator(config);
    let lastResult = null;

    const recordResult = (result) => {
      if (!result) {
        lastResult = null;
      }

      lastResult = result;
    }

    return {
      validate: (input) => {
        const result = func({ ...validatedConfig, ...input });
        
        recordResult(result);
        
        return typeof result === 'boolean' ? !result : result == null;
      },

      getConfig: () => {
        return validatedConfig;
      },

      getResult: () => {
        return {
          result: lastResult
        };
      }
    }
};

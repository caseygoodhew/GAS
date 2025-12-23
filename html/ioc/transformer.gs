const testTransformIOCConfiguration = () => {
  const sample = getSampleIOCConfiguration();
  //sample[0].dateRangeMode = 'same-as';
  const result = transformIOCConfiguration().transform(sample);
  const actual = JSON.stringify(result);

  // Sheets and JSON stringify seem to serialize TZ differently, so 17:00 is ok in this check
  const expected = JSON.stringify([
    {
      "startDate": addMonths(getGlobalsSheet().getLatest(), -6),
      "endDate": getGlobalsSheet().getLatest()
    },
    {
      "startDate": "2025-10-08T17:00:00.000Z",
      "endDate": "2025-10-22T17:00:00.000Z"
    },
    {
      "startDate": "2022-04-06T17:00:00.000Z",
      "endDate": "2023-04-05T17:00:00.000Z"
    },
    {
      "startDate": "2025-08-01T17:00:00.000Z",
      "endDate": "2025-12-01T18:00:00.000Z"
    }
  ]);

  if (actual !== expected) {
    throw new Error(`Actual and expected DO NOT MATCH`)
  }
}

let memoizedTransformIOCConfiguration = null;
const transformIOCConfiguration = () => {
  
  if (memoizedTransformIOCConfiguration) {
    return memoizedTransformIOCConfiguration;
  }

  const offsetPeriodRe = /^([0-9]+)\-(day|week|month|year)[s]{0,1}$/i;
  const taxYearRe = /^([2-3][0-9])\/([2-3][0-9])$/;
  
  const parseOffsetPeriod = (value) => {
    const matches = value.match(offsetPeriodRe);
    
    let offsetFn;
    
    switch (matches[2].toLowerCase()) {
      case 'day':
        offsetFn = (date, num) => addDays(date, num);
        break;
      case 'week':
        offsetFn = (date, num) => addDays(date, num * 7);
        break;
      case 'month':
        offsetFn = (date, num) => addMonths(date, num);
        break;
      case 'year':
        offsetFn = (date, num) => addMonths(date, num * 12);
        break;
      default:
        throw new Error(`Unknown offset period "${matches[2]}"`)
    }
    
    return {
      num: parseInt(matches[1], 10),
      fn: offsetFn
    }
  }
  
  const calculateOffsetAfter = (date, value) => {
    const offset = parseOffsetPeriod(value);
    return offset.fn(date, offset.num);
  }

  const calculateOffsetBefore = (date, value) => {
    const offset = parseOffsetPeriod(value);
    return offset.fn(date, -1 * offset.num);
  }

  const calculateStartDateOfTaxYear = (taxYear) => {
    const matches = taxYear.match(taxYearRe);
    const firstYear = parseInt(matches[1], 10);
    
    return new Date(2000 + firstYear, 3, 6);
  }

  let startDate;
  let endDate;
  
  const calculateDateRange = (item, others) => {
    switch (item.dateRangeMode) {
      case 'current':
        endDate = getGlobalsSheet().getLatest();
        return {
          startDate: calculateOffsetBefore(endDate, item.offsetPeriod),
          endDate
        }
        
      case 'fixed-start':
        startDate = setTime(new Date(item.startDate), 18)
        return {
          startDate,
          endDate: calculateOffsetAfter(startDate, item.offsetPeriod)
        }
        
      case 'fixed-end':
        endDate = setTime(new Date(item.endDate), 18)
        return {
          startDate: calculateOffsetBefore(endDate, item.offsetPeriod),
          endDate
        }

      case 'tax-year':
        startDate = setTime(calculateStartDateOfTaxYear(item.taxYear), 18);
        endDate = addDays(addMonths(startDate, 12), -1);
        return {
          startDate,
          endDate
        }
        
      case 'same-as':
        const index = parseInt(item.dateSameAs, 10) - 1;
        if (others[index]) {
          return { 
            startDate: others[index].startDate,
            endDate: others[index].endDate
          }
        }
        
        return false;

      case 'custom':
        const date1 = setTime(new Date(item.startDate), 18);
        const date2 = setTime(new Date(item.endDate), 18);
        return {
          startDate: new Date(Math.min(date1, date2)),
          endDate: new Date(Math.max(date1, date2)),
        }
        
      default:
        throw new Error(`Unknown dateRangeMode "${item.dateRangeMode}"`);
    }
  }

  const funcs = {
    transform: (configuration) => {
      const dates = [];

      while (dates.length !== configuration.length || dates.filter(x => !x).length > 0) {
        for (let i = 0; i < configuration.length; i++) {
          if (!dates[i]) {
            dates[i] = calculateDateRange(configuration[i], dates);
          }
        }
      }

      return dates;
    },

    getOffsetPeriodRe: () => {
      return offsetPeriodRe;
    },

    getTaxYearRe: () => {
      return taxYearRe;
    }
  }

  memoizedTransformIOCConfiguration = funcs;
  return funcs;
}

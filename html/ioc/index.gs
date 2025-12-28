const testIOCGetFactorConfigs = () => {
  const result = getIOCFactorConfigs();
  const aaa = 0;
}

const showIOCChartConfigurationSidebar = () => {
  const html = HtmlService.createTemplateFromFile('html/ioc/sidebar')
    .evaluate()
    .setTitle('Chart Configuration')
    .setWidth(300); // Note: Sidebars have a fixed width of 300px
  
  SpreadsheetApp.getUi().showSidebar(html);
};

const getIOCInitializationData = () => {
  return apiResponse({
    'getIOCFactorConfigs': getIOCFactorConfigs(),
    'getIOCCurrentConfiguration': getIOCCurrentConfiguration(),
    'globals': {
      'minDate': getGlobalsSheet().getEarliest(),
      'maxDate': getGlobalsSheet().getLatest(),
    }
  });
}

const getIOCFactorConfigs = () => {
  const factors = stockGrowthFactorSnapshotSheet().getFactorLabels();
  const accountNames = getGlobalsSheet().getAccounts();
  
  return {
    all: factors['all'][0],
    accounts: factors['accounts'].reduce((acc, key) => ({
      ...acc,
      [key]: accountNames[key]
    }), {}),
    symbols: factors['symbols'].reduce((acc, key) => ({
      ...acc,
      [key]: stockPriceReader.getCompanyNameOf(key)
    }), {})
  };
}

const getIOCCurrentConfiguration = () => {
  return investmentOverviewChartsSheet().loadConfiguration();
}

const setIOCCurrentConfiguration = data => {
  const validator = iocConfigurationValidator();
  const { ERROR, WARN } = validator.getConstants();

  const results = validator.validate(data);
  
  if (results.status === ERROR) {
    throw new UserError(results)
  }
  
  // stores the configuration
  investmentOverviewChartsSheet().storeConfiguration(data);
  // udpates the chart data
  investmentOverviewChartsSheet().updateCharts(
    transformIOCConfiguration().transform(data)
  );

  if (results.status === WARN) {
    throw new UserError(results)
  }
}




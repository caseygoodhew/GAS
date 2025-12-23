const testIOCGetFactorConfigs = () => {
  getFactorConfigs();
}

const showIOCChartConfigurationSidebar = () => {
  const html = HtmlService.createTemplateFromFile('html/ioc/sidebar')
    .evaluate()
    .setTitle('Chart Configuration')
    .setWidth(300); // Note: Sidebars have a fixed width of 300px
  
  SpreadsheetApp.getUi().showSidebar(html);
};

const getInitializationData = () => {
  return apiResponse({
    'getFactorConfigs': getFactorConfigs(),
    'getIOCCurrentConfiguration': getIOCCurrentConfiguration(),
    'globals': {
      'minDate': getGlobalsSheet().getEarliest(),
      'maxDate': getGlobalsSheet().getLatest(),
    }
  });
}

const getFactorConfigs = () => {
  const factorLabels = stockGrowthFactorSnapshotSheet().getFactorLabels();
  const accountNames = getGlobalsSheet().getAccounts();
  const symbolNames = factorLabels.symbols.map(symbol => stockPriceReader.getCompanyNameOf(symbol));
  const aaa = 0;
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




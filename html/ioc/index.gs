const showIOCChartConfigurationSidebar = () => {
  const html = HtmlService.createTemplateFromFile('html/ioc/sidebar')
    .evaluate()
    .setTitle('Chart Configuration')
    .setWidth(300); // Note: Sidebars have a fixed width of 300px
  
  SpreadsheetApp.getUi().showSidebar(html);
};

const getInitializationData = () => {
  return apiResponse({
    'getIOCCurrentConfiguration': getIOCCurrentConfiguration(),
    'globals': {
      'minDate': getGlobalsSheet().getEarliest(),
      'maxDate': getGlobalsSheet().getLatest(),
    }
  });
}

const getIOCCurrentConfiguration = () => {
  return investmentOverviewChartsSheet().getConfiguration();
}

const setIOCCurrentConfiguration = data => {
  const validator = iocConfigurationValidator();
  const { ERROR, WARN } = validator.getConstants();

  const results = validator.validate(data);
  
  if (results.status === ERROR) {
    throw new UserError(results)
  }
  
  investmentOverviewChartsSheet().setConfiguration(data);

  if (results.status === WARN) {
    throw new UserError(results)
  }
}




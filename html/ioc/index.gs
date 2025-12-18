const showIOCChartConfigurationSidebar = () => {
  const html = HtmlService.createTemplateFromFile('html/ioc/sidebar')
    .evaluate()
    .setTitle('Chart Configuration')
    .setWidth(300); // Note: Sidebars have a fixed width of 300px
  
  SpreadsheetApp.getUi().showSidebar(html);
};

const getIOCCurrentConfiguration = () => {
  return investmentOverviewChartsSheet().getConfiguration();
}

const setIOCCurrentConfiguration = data => {
  investmentOverviewChartsSheet().setConfiguration(data);
}


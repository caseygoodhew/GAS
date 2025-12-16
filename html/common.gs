function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

function includeCommon() {
  return include('html/common_client');
}

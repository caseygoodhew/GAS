function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

function includeCommon() {
  return [
    // this may need to move to the header at some point
    include('html/common_stylesheet'),
    include('html/spinner'),
    include('html/alert'),
    include('html/common_javascript')
  ].join('\n');
}

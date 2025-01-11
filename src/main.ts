function doGet(e: GoogleAppsScript.Events.DoGet) {
  return HtmlService.createHtmlOutput('Hello, world!');
}

function doPost(e: GoogleAppsScript.Events.DoPost) {
  return ContentService.createTextOutput('Received POST request');
}

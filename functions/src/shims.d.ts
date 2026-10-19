// pdf-parse's index.js reads a test PDF when loaded as the main module, so the
// library entry is imported directly.
declare module 'pdf-parse/lib/pdf-parse.js' {
  import pdf from 'pdf-parse';
  export default pdf;
}

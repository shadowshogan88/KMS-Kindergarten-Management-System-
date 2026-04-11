/* global CKEDITOR */

/**
 * CKEditor config for Decoupled Document Editor (Canvas-style layout).
 *
 * HOW TO CHANGE TOOLBAR ITEMS:
 * - Edit `window.assignmentCkeditorConfig.toolbar.items`
 *
 * HOW TO ENABLE/DISABLE PLUGINS:
 * - When using the CKEditor "super-build" CDN, plugins are pre-bundled.
 * - You can remove toolbar items you don't want, or add more if available.
 */

window.assignmentCkeditorConfig = {
  toolbar: {
    shouldNotGroupWhenFull: false,
    items: [
      'undo',
      'redo',
      '|',
      'heading',
      'style',
      '|',
      'fontSize',
      '|',
      'bold',
      'italic',
      'underline',
      'link',
      '|',
      'insertImage',
      'mediaEmbed',
      'insertTable',
      'codeBlock',
      '|',
      'bulletedList',
      'numberedList',
      'outdent',
      'indent',
    ],
  },
  image: {
    toolbar: ['imageTextAlternative', 'toggleImageCaption', '|', 'imageStyle:inline', 'imageStyle:wrapText', 'imageStyle:breakText'],
  },
  table: {
    contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties'],
  },
  placeholder: 'Write your submission…',
};


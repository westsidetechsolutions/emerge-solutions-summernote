(function(factory) {
    /* global define */
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node/CommonJS
        module.exports = factory(require('jquery'));
    } else {
        // Browser globals
        factory(window.jQuery);
    }
}(function($) {
    // Extends plugins for adding cell background color
    $.extend($.summernote.plugins, {
        'cellBackgroundColor': function(context) {
            var ui = $.summernote.ui;
            var $editor = context.layoutInfo.editor;
            var options = context.options;
            var lang = options.langInfo;

            // Add button to table popover
            context.memo('button.cellBackgroundColor', function() {
                var button = ui.button({
                    contents: '<i class="fas fa-fill-drip"></i>',
                    tooltip: 'Cell Background Color',
                    click: function(e) {
                        // Prevent default to avoid losing focus
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Save the current range
                        context.invoke('editor.saveRange');
                        
                        // Show the color picker
                        showCellColorPicker();
                    }
                });

                return button.render();
            });

            function showCellColorPicker() {
                var $colorPicker = createColorPicker();
                
                // Get the position of the table popover
                var $popover = $editor.find('.note-popover.note-table-popover');
                var position;
                
                if ($popover.length) {
                    // Position relative to the table popover
                    position = $popover.offset();
                    position.top += $popover.outerHeight() + 5;
                } else {
                    // Fallback position in the center of the editor
                    var editorPos = $editor.offset();
                    position = {
                        left: editorPos.left + ($editor.width() / 2) - 90,
                        top: editorPos.top + ($editor.height() / 2) - 100
                    };
                }
                
                $colorPicker.css({
                    'position': 'absolute',
                    'z-index': 10000,
                    'display': 'block',
                    'left': position.left,
                    'top': position.top,
                    'background-color': '#fff',
                    'border': '1px solid #ccc',
                    'padding': '10px',
                    'border-radius': '4px',
                    'box-shadow': '0 2px 5px rgba(0,0,0,0.2)'
                }).addClass('cell-bg-color-picker');
                
                $('body').append($colorPicker);
                
                // Close when clicking outside
                $(document).one('mousedown', function(e) {
                    if (!$(e.target).closest('.cell-bg-color-picker, .note-btn').length) {
                        $colorPicker.remove();
                    }
                });
            }
            
            function createColorPicker() {
                var colors = [
                    ['#FFFFFF', '#E8E8E8', '#D8D8D8', '#B8B8B8', '#888888', '#484848', '#000000'],
                    ['#FF9999', '#FFCC99', '#FFFF99', '#CCFF99', '#99FF99', '#99FFCC', '#99FFFF'],
                    ['#FF6666', '#FFCC66', '#FFFF66', '#CCFF66', '#66FF66', '#66FFCC', '#66FFFF'],
                    ['#FF0000', '#FF9900', '#FFFF00', '#99FF00', '#00FF00', '#00FF99', '#00FFFF']
                ];
                
                var $container = $('<div class="cell-bg-color-container"></div>');
                
                // Add "Remove Color" button
                var $removeBtn = $('<button type="button" class="cell-bg-color-reset">Remove Color</button>')
                    .on('click', function() {
                        applyColorToCell('transparent');
                        $('.cell-bg-color-picker').remove();
                    });
                
                $container.append($removeBtn);
                
                // Add color buttons
                colors.forEach(function(row) {
                    var $row = $('<div class="cell-bg-color-row"></div>');
                    
                    row.forEach(function(color) {
                        var $btn = $('<button type="button" class="cell-bg-color-btn"></button>')
                            .css('background-color', color)
                            .attr('data-color', color)
                            .on('click', function() {
                                applyColorToCell($(this).attr('data-color'));
                                $('.cell-bg-color-picker').remove();
                            });
                        
                        $row.append($btn);
                    });
                    
                    $container.append($row);
                });
                
                return $container;
            }
            
            function applyColorToCell(color) {
                // Restore the saved range
                context.invoke('editor.restoreRange');
                
                // Get the current selection
                var rng = context.invoke('editor.createRange');
                
                // Find the closest table cell to the selection
                var $cell = $(rng.sc).closest('td, th');
                
                if ($cell.length) {
                    // Apply the background color
                    context.invoke('editor.beforeCommand');
                    $cell.css('background-color', color);
                    context.invoke('editor.afterCommand');
                    
                    // Focus back on the editor
                    context.invoke('editor.focus');
                } else {
                    console.log('No table cell found in the current selection');
                }
            }
            
            // Add plugin styles
            $('head').append(`
                <style>
                    .cell-bg-color-container {
                        min-width: 180px;
                    }
                    
                    .cell-bg-color-reset {
                        width: 100%;
                        padding: 5px 10px;
                        margin-bottom: 10px;
                        border: 1px solid #ddd;
                        background-color: #fff;
                        border-radius: 3px;
                        cursor: pointer;
                    }
                    
                    .cell-bg-color-reset:hover {
                        background-color: #f8f8f8;
                    }
                    
                    .cell-bg-color-row {
                        display: flex;
                        margin-bottom: 5px;
                    }
                    
                    .cell-bg-color-row:last-child {
                        margin-bottom: 0;
                    }
                    
                    .cell-bg-color-btn {
                        width: 20px;
                        height: 20px;
                        margin-right: 5px;
                        border: 1px solid #ccc;
                        border-radius: 2px;
                        cursor: pointer;
                    }
                    
                    .cell-bg-color-btn:last-child {
                        margin-right: 0;
                    }
                    
                    .cell-bg-color-btn:hover {
                        border-color: #000;
                    }
                </style>
            `);
        }
    });
})); 
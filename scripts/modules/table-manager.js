/**
 * Table Manager Module
 * Handles table styling, resizing, and management functionality
 */
const TableManager = (function() {
    'use strict';
    
    // Private variables
    let isInitialized = false;
    
    // Private functions
    function cleanupTableStyles() {
        const $editor = $('.note-editable');
        
        // Find all tables in the editor
        $editor.find('table').each(function() {
            const $table = $(this);
            
            // Add the summernote-table class if not already present
            if (!$table.hasClass('summernote-table')) {
                $table.addClass('summernote-table');
            }
            
            // Remove inline styles from table elements
            $table.removeAttr('style');
            $table.find('th, td').each(function() {
                const $cell = $(this);
                const cellStyle = $cell.attr('style');
                
                if (cellStyle) {
                    // Parse the style attribute to extract useful information
                    const styles = {};
                    cellStyle.split(';').forEach(function(style) {
                        const [property, value] = style.split(':').map(s => s.trim());
                        if (property && value) {
                            styles[property] = value;
                        }
                    });
                    
                    // Convert common inline styles to CSS classes
                    if (styles['text-align']) {
                        switch (styles['text-align']) {
                            case 'left':
                                $cell.addClass('text-left');
                                break;
                            case 'center':
                                $cell.addClass('text-center');
                                break;
                            case 'right':
                                $cell.addClass('text-right');
                                break;
                            case 'justify':
                                $cell.addClass('text-justify');
                                break;
                        }
                    }
                    
                    if (styles['vertical-align']) {
                        switch (styles['vertical-align']) {
                            case 'top':
                                $cell.addClass('align-top');
                                break;
                            case 'middle':
                                $cell.addClass('align-middle');
                                break;
                            case 'bottom':
                                $cell.addClass('align-bottom');
                                break;
                        }
                    }
                    
                    // Remove the inline style attribute
                    $cell.removeAttr('style');
                }
            });
        });
    }
    
    function makeTablesResizable() {
        const $editor = $('.note-editable');
        
        // First, clean up any existing table styles
        cleanupTableStyles();
        
        // Find all tables in the editor
        $editor.find('table').each(function() {
            const $table = $(this);
            
            // Skip if already processed
            if ($table.hasClass('resizable-added')) return;
            
            // Mark as processed
            $table.addClass('resizable-added');
            
            // Create column resize handles for the entire table
            const $headerRow = $table.find('tr:first');
            const columnCount = $headerRow.find('th, td').length;
            
            // Create a container for the resize handles
            const $resizeContainer = $('<div class="table-resize-container"></div>').css({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
            });
            
            // Position the table relatively to allow absolute positioning of handles
            $table.css('position', 'relative').append($resizeContainer);
            
            // Add resize handles between columns
            for (let i = 0; i < columnCount - 1; i++) {
                const cells = $table.find(`tr td:nth-child(${i + 1}), tr th:nth-child(${i + 1})`);
                if (cells.length === 0) continue;
                
                // Calculate position for the resize handle
                const lastCell = cells.last();
                const cellRight = cells.first().position().left + cells.first().outerWidth();
                
                // Create the resize handle that spans the entire height of the table
                const $resizeHandle = $('<div class="column-resize-handle"></div>').css({
                    position: 'absolute',
                    top: 0,
                    left: cellRight - 3,
                    width: '6px',
                    height: '100%',
                    cursor: 'col-resize',
                    pointerEvents: 'auto',
                    zIndex: 1
                });
                
                $resizeContainer.append($resizeHandle);
                
                // Add event listener for resize handle
                $resizeHandle.on('mousedown', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const startX = e.pageX;
                    const columnCells = $table.find(`tr td:nth-child(${i + 1}), tr th:nth-child(${i + 1})`);
                    const nextColumnCells = $table.find(`tr td:nth-child(${i + 2}), tr th:nth-child(${i + 2})`);
                    const startWidth = columnCells.first().outerWidth();
                    const tableWidth = $table.width();
                    
                    // Add overlay to capture mouse events
                    const $overlay = $('<div class="resize-overlay"></div>').css({
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 9999
                    }).appendTo('body');
                    
                    $overlay.on('mousemove', function(e) {
                        const diffX = e.pageX - startX;
                        const newWidth = Math.max(20, startWidth + diffX);
                        
                        // Set width for all cells in this column
                        columnCells.width(newWidth);
                        
                        // Update the position of this and all subsequent resize handles
                        updateResizeHandlePositions($table);
                    });
                    
                    $overlay.on('mouseup', function() {
                        $overlay.remove();
                    });
                });
            }
        });
    }
    
    function updateResizeHandlePositions($table) {
        const $handles = $table.find('.column-resize-handle');
        const $headerRow = $table.find('tr:first');
        
        $headerRow.find('th, td').each(function(index, cell) {
            if (index < $handles.length) {
                const $cell = $(cell);
                const cellRight = $cell.position().left + $cell.outerWidth();
                $($handles[index]).css('left', cellRight - 3);
            }
        });
    }
    
    // Public API
    return {
        // Initialize the table manager
        init: function() {
            if (isInitialized) return;
            
            // Initial cleanup and setup
            setTimeout(function() {
                cleanupTableStyles();
                makeTablesResizable();
            }, 100);
            
            isInitialized = true;
        },
        
        // Clean up table styles and convert inline styles to CSS classes
        cleanupTableStyles: function() {
            cleanupTableStyles();
        },
        
        // Make all tables in the editor resizable
        makeTablesResizable: function() {
            makeTablesResizable();
        },
        
        // Update resize handle positions after resizing
        updateResizeHandlePositions: function($table) {
            updateResizeHandlePositions($table);
        },
        
        // Process tables when content changes
        onContentChange: function() {
            cleanupTableStyles();
            makeTablesResizable();
        },
        
        // Get Summernote table configuration
        getSummernoteConfig: function() {
            return {
                tableClassName: 'summernote-table',
                table: [
                    ['add', ['addRowDown', 'addRowUp', 'addColLeft', 'addColRight']],
                    ['delete', ['deleteRow', 'deleteCol', 'deleteTable']],
                    ['color', ['cellBackgroundColor']]
                ]
            };
        },
        
        // Check if table manager is initialized
        isInitialized: function() {
            return isInitialized;
        }
    };
})();

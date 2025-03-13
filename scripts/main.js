$(document).ready(function() {
    // Initialize Asset Manager
    const assetStore = {
        root: {
            name: 'Root',
            type: 'folder',
            children: []
        },
        currentPath: ['root'],
        
        getCurrentFolder: function() {
            let current = this.root;
            for (let i = 1; i < this.currentPath.length; i++) {
                current = current.children.find(
                    item => item.id === this.currentPath[i]
                );
            }
            return current;
        },
        
        addFolder: function(name) {
            const folder = {
                id: Date.now().toString(),
                name: name,
                type: 'folder',
                children: []
            };
            this.getCurrentFolder().children.push(folder);
            this.renderTree();
        },
        
        addFile: function(file) {
            const reader = new FileReader();
            reader.onload = () => {
                const fileData = {
                    id: Date.now().toString(),
                    name: file.name,
                    type: 'file',
                    data: reader.result,
                    mimeType: file.type
                };
                this.getCurrentFolder().children.push(fileData);
                this.renderTree();
            };
            reader.readAsDataURL(file);
        },
        
        renderTree: function() {
            // Update current path display
            const pathParts = [];
            for (let i = 0; i < this.currentPath.length; i++) {
                if (i === 0) {
                    pathParts.push('Root');
                } else {
                    let current = this.root;
                    for (let j = 1; j <= i; j++) {
                        const pathId = this.currentPath[j];
                        current = current.children.find(item => item.id === pathId);
                        if (!current) break;
                    }
                    if (current) pathParts.push(current.name);
                }
            }
            const pathDisplay = pathParts.join(' / ');
            
            $('#currentPath').text(pathDisplay);
            
            // Render list view
            const renderListItem = (item) => {
                const li = $('<li>')
                    .addClass(item.type)
                    .text(item.name)
                    .attr('data-id', item.id);
                
                if (item.type === 'folder') {
                    li.prepend('<i class="fas fa-folder"></i> ');
                    li.on('dblclick', () => {
                        this.currentPath.push(item.id);
                        this.renderTree();
                    });
                } else {
                    li.prepend('<i class="fas fa-file"></i> ');
                }
                return li;
            };
            
            const tree = $('#assetTree').empty();
            if (this.currentPath.length > 1) {
                tree.append(
                    $('<li>')
                        .addClass('folder up')
                        .html('<i class="fas fa-level-up-alt"></i> ..')
                        .on('click', () => {
                            this.currentPath.pop();
                            this.renderTree();
                        })
                );
            }
            
            // Render grid view
            const grid = $('#assetGrid').empty();
            
            // Add back folder in grid view
            if (this.currentPath.length > 1) {
                const backFolder = $('<div>')
                    .addClass('asset-item folder')
                    .attr('data-id', 'back')
                    .on('click', () => {
                        this.currentPath.pop();
                        this.renderTree();
                    });
                
                const thumbnail = $('<div>').addClass('asset-thumbnail');
                thumbnail.append('<i class="fas fa-level-up-alt"></i>');
                
                const name = $('<div>').addClass('asset-name').text('..');
                
                backFolder.append(thumbnail).append(name);
                grid.append(backFolder);
            }
            
            // Add folders and files
            this.getCurrentFolder().children.forEach(item => {
                // Add to list view
                tree.append(renderListItem(item));
                
                // Add to grid view
                const gridItem = $('<div>')
                    .addClass('asset-item')
                    .addClass(item.type)
                    .attr('data-id', item.id);
                
                const thumbnail = $('<div>').addClass('asset-thumbnail');
                
                if (item.type === 'folder') {
                    thumbnail.append('<i class="fas fa-folder"></i>');
                    gridItem.on('dblclick', () => {
                        this.currentPath.push(item.id);
                        this.renderTree();
                    });
                } else if (item.mimeType && item.mimeType.startsWith('image/')) {
                    thumbnail.append($('<img>').attr('src', item.data));
                } else {
                    thumbnail.append('<i class="fas fa-file"></i>');
                }
                
                const name = $('<div>').addClass('asset-name').text(item.name);
                
                gridItem.append(thumbnail).append(name);
                grid.append(gridItem);
            });
            
            // Show the active view
            if ($('#gridViewBtn').hasClass('active')) {
                $('#assetTree').hide();
                $('#assetGrid').show();
            } else {
                $('#assetGrid').hide();
                $('#assetTree').show();
            }
        }
    };

    var AssetManagerButton = function (context) {
        var ui = $.summernote.ui;
      
        // create button
        var button = ui.button({
          contents: '<i class="fas fa-folder-open"/> Asset Manager',
          tooltip: 'Asset Manager',
          click: function () {
            // Open the asset manager modal
            $('#assetManagerModal').modal('show');
          }
        });
      
        return button.render(); // return button as jquery object
    }

    // Initialize Summernote
    $('#summernote').summernote({
        buttons: {
            assetManager: AssetManagerButton
        },
        height: 400,
        minHeight: null,
        maxHeight: null,
        focus: true,
        fontNames: ['Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Helvetica', 'Impact', 'Tahoma', 'Times New Roman', 'Verdana', 
            'Liberation Sans', 'Proximanova Regular'],

        fontNamesIgnoreCheck: ['Liberation Sans', 'Proximanova Regular'],
        toolbar: [
            ['style', ['style']],
            ['font', ['bold', 'italic', 'underline', 'clear']],
            ['fontname', ['fontname']],
            ['fontsize', ['fontsize']],
            ['color', ['color']],
            ['para', ['ul', 'ol', 'paragraph']],
            ['height', ['height']],
            ['table', ['table']],
            ['insert', ['link', 'picture', 'video', 'assetManager']],
            ['misc', ['codeview']],
            ['view', ['fullscreen', 'codeview']]
        ],
        fontSizes: ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '28', '32', '36', '48', '64', '72'],
        // Remove status bar
        disableResizeEditor: true,
        // Customize placeholder
        placeholder: 'Type something...',
        // Modern styling
        styleTags: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'],
        // Simplified popover
        popover: {
            image: [
                ['imagesize', ['imageSize100', 'imageSize50']],
                ['float', ['floatLeft', 'floatRight', 'floatNone']],
                ['remove', ['removeMedia']]
            ],
            link: [
                ['link', ['linkDialogShow', 'unlink']]
            ],
            table: [
                ['add', ['addRowDown', 'addRowUp', 'addColLeft', 'addColRight']],
                ['delete', ['deleteRow', 'deleteCol', 'deleteTable']],
                ['color', ['cellBackgroundColor']]
            ]
        },
        // Add these to your existing configuration
        prettifyHtml: true,
        codemirror: {
            theme: 'default',
            mode: 'text/html',
            htmlMode: true,
            lineNumbers: true,
            lineWrapping: true,
            matchBrackets: true,
            autoCloseTags: true,
            autoCloseBrackets: true,
            styleActiveLine: true
        },
        callbacks: {
            onInit: function() {
                console.log('Summernote initialized');
                // Add table resizing functionality after Summernote is initialized
                setTimeout(makeTablesResizable, 100);
            },
            onChange: function(contents, $editable) {
                // When content changes, check for new tables and make them resizable
                makeTablesResizable();
            }
        }
    });

    // Load custom fonts CSS
    $('head').append('<link rel="stylesheet" href="/fonts/fonts.css">');

    // Note: The cell background color functionality is provided by the external plugin in summernote-cell-background.js

    // Style the font dropdown to show actual font previews

    // Completely rewrite the table cell background color implementation
    // Create a simpler implementation that works with Summernote's built-in systems
    
    // Override the link dialog to include asset manager option
    $(document).on('click', '.note-link-btn', function(e) {
        e.preventDefault();
        
        // Store the original link dialog
        const originalDialog = $('.note-link-dialog');
        if (originalDialog.length) {
            // Add asset manager button to the dialog
            if (!originalDialog.find('.asset-manager-link-btn').length) {
                const assetBtn = $('<button>')
                    .addClass('btn btn-primary asset-manager-link-btn')
                    .html('<i class="fas fa-folder-open"></i> Choose from Asset Manager')
                    .css('margin-top', '10px')
                    .on('click', function(e) {
                        e.preventDefault();
                        $('#assetManagerModal').data('mode', 'link').modal('show');
                    });
                
                originalDialog.find('.form-group').last().after(
                    $('<div class="form-group">').append(assetBtn)
                );
            }
        }
    });

    // View toggle handlers
    $('#gridViewBtn').click(function() {
        $(this).addClass('active');
        $('#listViewBtn').removeClass('active');
        $('#assetTree').hide();
        $('#assetGrid').show();
    });
    
    $('#listViewBtn').click(function() {
        $(this).addClass('active');
        $('#gridViewBtn').removeClass('active');
        $('#assetGrid').hide();
        $('#assetTree').show();
    });

    // Asset Manager Event Handlers
    $('#createFolderBtn').click(() => {
        const folderName = prompt('Enter folder name:');
        if (folderName) {
            assetStore.addFolder(folderName);
        }
    });

    $('#uploadBtn').click(() => {
        $('#assetUpload').click();
    });

    $('#assetUpload').on('change', function(e) {
        Array.from(e.target.files).forEach(file => {
            assetStore.addFile(file);
        });
    });

    $('#selectAssetBtn').click(() => {
        let selectedId;
        
        // Check which view is active and get the selected item
        if ($('#gridViewBtn').hasClass('active')) {
            const selected = $('#assetGrid .asset-item.selected');
            if (selected.length) {
                selectedId = selected.data('id');
                console.log('Grid view selected ID:', selectedId);
            }
        } else {
            const selected = $('#assetTree li.selected');
            if (selected.length) {
                selectedId = selected.data('id');
                console.log('List view selected ID:', selectedId);
            }
        }
        
        if (selectedId) {
            // Special case for back button
            if (selectedId === 'back') {
                alert('Please select a file, not the back button');
                return;
            }
            
            // Find the selected item in the current folder
            const currentFolder = assetStore.getCurrentFolder();
            console.log('Current folder children:', currentFolder.children);
            
            // Convert selectedId to string to ensure consistent comparison
            const item = currentFolder.children.find(
                child => String(child.id) === String(selectedId)
            );
            
            
            if (item && item.type === 'file') {
                const mode = $('#assetManagerModal').data('mode') || 'insert';
                
                if (mode === 'link') {
                    // For link dialog
                    $('.note-link-text').val($('.note-link-text').val() || item.name);
                    $('.note-link-url').val(item.data);
                    $('.note-link-btn').removeClass('disabled');
                    console.log('Link dialog updated');
                } else {
                    // Direct insert
                    if (item.mimeType && item.mimeType.startsWith('image/')) {
                        // Insert image directly into the editor
                        console.log('Inserting image:', item.name, 'with data URL length:', item.data.length);
                        
                        // Create an image element and insert it
                        const image = $('<img>')
                            .attr('src', item.data)
                            .attr('alt', item.name)
                            .css('max-width', '100%');
                        
                        $('#summernote').summernote('insertNode', image[0]);
                        
                        console.log('Image inserted');
                    } else {
                        // Insert as a link
                        console.log('Inserting link:', item.name);
                        $('#summernote').summernote('createLink', {
                            text: item.name,
                            url: item.data,
                            isNewWindow: true
                        });
                        console.log('Link inserted');
                    }
                }
                $('#assetManagerModal').modal('hide');
            } else {
                // If it's a folder, don't do anything or show a message
                if (item && item.type === 'folder') {
                    alert('Please select a file, not a folder');
                } else {
                    alert('Could not find the selected item');
                    console.error('Item not found for ID:', selectedId);
                }
            }
        } else {
            alert('Please select an asset first');
        }
    });

    // Selection handlers for both views
    $('#assetTree').on('click', 'li', function() {
        $('#assetTree li').removeClass('selected');
        $('#assetGrid .asset-item').removeClass('selected');
        $(this).addClass('selected');
        console.log('Selected tree item:', $(this).text(), 'ID:', $(this).data('id'));
    });
    
    $('#assetGrid').on('click', '.asset-item', function() {
        $('#assetTree li').removeClass('selected');
        $('#assetGrid .asset-item').removeClass('selected');
        $(this).addClass('selected');
        console.log('Selected grid item:', $(this).find('.asset-name').text(), 'ID:', $(this).data('id'));
    });

    // Initialize on modal show
    $('#assetManagerModal').on('show.bs.modal', () => {
        // Default to grid view
        $('#gridViewBtn').addClass('active');
        $('#listViewBtn').removeClass('active');
        $('#assetGrid').show();
        $('#assetTree').hide();
        
        assetStore.renderTree();
    }).on('hidden.bs.modal', () => {
        // Reset mode when modal is closed
        $('#assetManagerModal').removeData('mode');
    });

    // Add resize handle to the editor
    const $editor = $('.note-editor');
    const $editable = $('.note-editable');
    
    if ($editor.length && $editable.length) {
        console.log('Found editor, adding resize handle');
        
        // Create and append the resize handle
        const $resizeHandle = $('<div class="note-resize-handle"></div>').appendTo($editor);
        
        // Add event listener for resize handle
        $resizeHandle.on('mousedown', function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const startY = event.clientY;
            const startHeight = $editable.outerHeight();
            
            $(document).on('mousemove', function(e) {
                const height = startHeight + (e.clientY - startY);
                
                $editable.css({
                    height: Math.max(height, 100) + 'px'
                });
            }).one('mouseup', function() {
                $(document).off('mousemove');
            });
        });
    }

    // Function to make table columns resizable
    function makeTablesResizable() {
        const $editor = $('.note-editable');
        
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
    
    // Function to update resize handle positions after resizing
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
});

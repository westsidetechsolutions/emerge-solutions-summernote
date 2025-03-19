$(document).ready(function() {
    // Initialize Asset Manager
    const assetStore = {
        root: {
            name: 'Root',
            type: 'folder',
            children: []
        },
        currentPath: ['root'],
        
        // Add these methods for session storage
        saveToSessionStorage: function() {
            try {
                // Convert any large binary data to references to avoid session storage limits
                const storableData = this.prepareForStorage(JSON.parse(JSON.stringify(this.root)));
                
                // Store the processed data structure
                sessionStorage.setItem('assetManagerRoot', JSON.stringify(storableData));
                
                // Store the current path separately
                sessionStorage.setItem('assetManagerCurrentPath', JSON.stringify(this.currentPath));
                
                console.log('Asset manager data saved to session storage');
            } catch(e) {
                console.error('Failed to save to session storage:', e);
            }
        },
        
        loadFromSessionStorage: function() {
            try {
                // Load the root structure
                const rootData = sessionStorage.getItem('assetManagerRoot');
                if (rootData) {
                    const parsedRoot = JSON.parse(rootData);
                    // Restore any binary data from separate storage
                    this.root = this.restoreFromStorage(parsedRoot);
                    console.log('Loaded asset structure from session storage');
                }
                
                // Load the current path
                const pathData = sessionStorage.getItem('assetManagerCurrentPath');
                if (pathData) {
                    this.currentPath = JSON.parse(pathData);
                    console.log('Restored navigation path from session storage');
                }
                
                return !!rootData; // Return true if we loaded data
            } catch(e) {
                console.error('Failed to load from session storage:', e);
                return false;
            }
        },
        
        prepareForStorage: function(dataObj) {
            // Make a deep copy we can modify
            const processedObj = {...dataObj};
            
            if (processedObj.children) {
                // Process each child
                processedObj.children = processedObj.children.map(child => {
                    if (child.type === 'folder') {
                        // Recursively process folder children
                        return this.prepareForStorage(child);
                    } else if (child.type === 'file' && child.data && child.data.length > 50000) {
                        // For large files, store data separately to avoid session storage limits
                        const storageKey = 'asset_file_' + child.id;
                        try {
                            sessionStorage.setItem(storageKey, child.data);
                            // Replace actual data with reference
                            const storedChild = {...child};
                            storedChild.data = null; // Clear the data
                            storedChild.dataRef = storageKey; // Save reference to where data is stored
                            return storedChild;
                        } catch(e) {
                            console.error('Failed to store large file data:', e);
                            // Return child with shortened data if we couldn't store it separately
                            const fallbackChild = {...child};
                            fallbackChild.data = fallbackChild.data.substring(0, 100) + '... [truncated due to storage limits]';
                            return fallbackChild;
                        }
                    } else {
                        // Return file as is if it's small enough
                        return child;
                    }
                });
            }
            
            return processedObj;
        },
        
        restoreFromStorage: function(dataObj) {
            const restoredObj = {...dataObj};
            
            if (restoredObj.children) {
                // Process each child to restore data
                restoredObj.children = restoredObj.children.map(child => {
                    if (child.type === 'folder') {
                        // Recursively restore folder children
                        return this.restoreFromStorage(child);
                    } else if (child.type === 'file' && child.dataRef) {
                        // For files with external data reference, restore the data
                        try {
                            const storedData = sessionStorage.getItem(child.dataRef);
                            const restoredChild = {...child};
                            
                            if (storedData) {
                                restoredChild.data = storedData;
                            } else {
                                console.warn('Could not find stored data for:', child.name);
                                restoredChild.data = ''; // Provide empty data if we couldn't restore
                            }
                            
                            delete restoredChild.dataRef; // Remove the reference
                            return restoredChild;
                        } catch(e) {
                            console.error('Failed to restore file data:', e);
                            return child;
                        }
                    } else {
                        // Return file as is
                        return child;
                    }
                });
            }
            
            return restoredObj;
        },
        
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
            this.saveToSessionStorage(); // Save after making changes
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
                this.saveToSessionStorage(); // Save after making changes
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
                    .attr('data-id', item.id);
                
                // Create container for the item name and delete button
                const itemContainer = $('<div>').addClass('item-container');
                
                // Add the appropriate icon and name
                if (item.type === 'folder') {
                    itemContainer.append('<i class="fas fa-folder"></i> ');
                    itemContainer.append($('<span>').text(item.name));
                    
                    li.append(itemContainer);
                    li.on('dblclick', () => {
                        this.navigateToFolder(item.id);
                    });
                } else {
                    itemContainer.append('<i class="fas fa-file"></i> ');
                    itemContainer.append($('<span>').text(item.name));
                    
                    li.append(itemContainer);
                }
                
                // Add delete button
                const deleteBtn = $('<button>')
                    .addClass('btn btn-sm btn-danger delete-btn')
                    .html('<i class="fas fa-trash"></i>')
                    .attr('title', 'Delete')
                    .on('click', (e) => {
                        e.stopPropagation(); // Prevent triggering other click events
                        
                        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                            this.deleteItem(item.id);
                        }
                    });
                
                li.append(deleteBtn);
                
                return li;
            };
            
            const tree = $('#assetTree').empty();
            if (this.currentPath.length > 1) {
                tree.append(
                    $('<li>')
                        .addClass('folder up')
                        .html('<i class="fas fa-level-up-alt"></i> ..')
                        .on('click', () => {
                            this.navigateToFolder('back');
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
                        this.navigateToFolder('back');
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
                        this.navigateToFolder(item.id);
                    });
                } else if (item.mimeType && item.mimeType.startsWith('image/')) {
                    thumbnail.append($('<img>').attr('src', item.data));
                } else {
                    thumbnail.append('<i class="fas fa-file"></i>');
                }
                
                const name = $('<div>').addClass('asset-name').text(item.name);
                
                // Add delete button for grid items
                const deleteBtn = $('<button>')
                    .addClass('btn btn-sm btn-danger delete-btn grid-delete-btn')
                    .html('<i class="fas fa-trash"></i>')
                    .attr('title', 'Delete')
                    .on('click', (e) => {
                        e.stopPropagation(); // Prevent triggering selection
                        
                        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                            this.deleteItem(item.id);
                        }
                    });
                
                gridItem.append(thumbnail).append(name).append(deleteBtn);
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
        },
        
        // Add this new method to update currentPath and save to storage
        navigateToFolder: function(folderId) {
            if (folderId === 'back' || folderId === 'up') {
                this.currentPath.pop(); // Go up one level
            } else {
                this.currentPath.push(folderId); // Go into the folder
            }
            this.saveToSessionStorage(); // Save the navigation state
            this.renderTree();
        },
        
        deleteItem: function(itemId) {
            // Find the parent folder containing the item
            let currentFolder = this.getCurrentFolder();
            
            // Find the item index in the current folder's children
            const itemIndex = currentFolder.children.findIndex(
                child => String(child.id) === String(itemId)
            );
            
            if (itemIndex !== -1) {
                const item = currentFolder.children[itemIndex];
                
                // Check if it's a folder and not empty
                if (item.type === 'folder' && item.children && item.children.length > 0) {
                    alert('Cannot delete non-empty folder. Please delete its contents first.');
                    return false;
                }
                
                // Remove the item from the array
                currentFolder.children.splice(itemIndex, 1);
                
                // If the item is a file with a dataRef, clean up session storage
                if (item.type === 'file' && item.dataRef) {
                    try {
                        sessionStorage.removeItem(item.dataRef);
                    } catch(e) {
                        console.error('Failed to remove file data from session storage:', e);
                    }
                }
                
                // Save changes to session storage
                this.saveToSessionStorage();
                // Refresh the display
                this.renderTree();
                return true;
            }
            
            return false;
        },
        clearAll: function() {
            // Reset the root folder to empty
            this.root = {
                name: 'Root',
                type: 'folder',
                children: []
            };
            
            // Reset navigation to root
            this.currentPath = ['root'];
            
            // Clear all asset-related items from session storage
            try {
                // Clear the main asset structure
                sessionStorage.removeItem('assetManagerRoot');
                sessionStorage.removeItem('assetManagerCurrentPath');
                
                // Find and clear all asset file data entries
                const keysToRemove = [];
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && key.startsWith('asset_file_')) {
                        keysToRemove.push(key);
                    }
                }
                
                // Remove each asset file entry
                keysToRemove.forEach(key => {
                    sessionStorage.removeItem(key);
                });
                
                console.log('Asset manager cleared successfully');
            } catch(e) {
                console.error('Error clearing asset manager:', e);
            }
            
            // Update the UI
            this.renderTree();
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

    // Replace the existing link button handling with this custom implementation
    var LinkButton = function (context) {
        var ui = $.summernote.ui;
      
        // Create a custom button that replaces the standard link button
        var button = ui.button({
            contents: '<i class="fas fa-link"/>',
            tooltip: 'Link',
            click: function () {
                // When clicked, show our custom modal with two options instead of default link dialog
                $('#linkOptionsModal').modal('show');
            }
        });
      
        return button.render();
    };

    // Initialize Summernote
    $('#summernote').summernote({
        buttons: {
            assetManager: AssetManagerButton,
            linkCustom: LinkButton
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
            ['insert', ['linkCustom', 'picture', 'video', 'assetManager']],
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
            ],
            video: [
                ['videosize', ['videoSize100', 'videoSize75', 'videoSize50']],
                ['float', ['floatLeft', 'floatRight', 'floatNone']],
                ['remove', ['removeMedia']]
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
                // Add resize functionality after Summernote is initialized
                setTimeout(function() {
                    makeTablesResizable();
                    makeVideosResizable();
                }, 100);
            },
            onChange: function(contents, $editable) {
                // When content changes, check for new elements and make them resizable
                makeTablesResizable();
                makeVideosResizable();
            }
        }
    });

    // Load custom fonts CSS
    $('head').append('<link rel="stylesheet" href="/fonts/fonts.css">');

    // Note: The cell background color functionality is provided by the external plugin in summernote-cell-background.js

    // Style the font dropdown to show actual font previews

    // Completely rewrite the table cell background color implementation
    // Create a simpler implementation that works with Summernote's built-in systems
    
    // Add this to your document ready function to create the link options modal
    const linkOptionsModal = `
    <div class="modal fade" id="linkOptionsModal" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Insert Link</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-6 text-center">
                            <button id="manualLinkBtn" class="btn btn-primary btn-lg">
                                <i class="fas fa-link"></i><br>
                                Manual Link
                            </button>
                        </div>
                        <div class="col-md-6 text-center">
                            <button id="assetLinkBtn" class="btn btn-secondary btn-lg">
                                <i class="fas fa-folder-open"></i><br>
                                From Asset Manager
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    $('body').append(linkOptionsModal);

    // Handle the link option buttons
    $('#manualLinkBtn').click(function() {
        // Close our modal
        $('#linkOptionsModal').modal('hide');
        
        // We need to trigger the native Summernote link dialog
        // Instead of calling createLink directly, which doesn't show the dialog
        setTimeout(function() {
            // Use the native Summernote command to show the link dialog
            $('#summernote').summernote('linkDialog.show');
        }, 100);  // Small delay to ensure our modal is closed first
    });

    $('#assetLinkBtn').click(function() {
        // Close our modal
        $('#linkOptionsModal').modal('hide');
        
        // Open the asset manager with link mode
        $('#assetManagerModal').data('mode', 'link').modal('show');
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
    $('#createFolderBtn').off('click').on('click', function() {
        const folderName = prompt('Enter folder name:');
        if (folderName) {
            assetStore.addFolder(folderName);
        }
    });

    $('#uploadBtn').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Reset the input and trigger file selection dialog
        const fileInput = $('#assetUpload')[0];
        fileInput.value = '';
        fileInput.click();
    });

    $('#assetUpload').off('change').on('change', function(e) {
        e.preventDefault();
        
        const files = e.target.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(file => {
                assetStore.addFile(file);
            });
        }
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
        
        if (!selectedId) {
            alert('Please select an asset first');
            return;
        }
        
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
        
        if (!item) {
            console.error('Item not found for ID:', selectedId);
            // Don't show alert here since the item may have been processed already
            return;
        }
        
        if (item.type === 'folder') {
            alert('Please select a file, not a folder');
            return;
        }
        
        // Now we're sure this is a file and we found it
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
        
        // Close the modal when done
        $('#assetManagerModal').modal('hide');
    });

    // Selection handlers for both views
    $('#assetTree').on('click', 'li', function(e) {
        // Don't select if clicking on the delete button
        if ($(e.target).closest('.delete-btn').length === 0) {
            $('#assetTree li').removeClass('selected');
            $('#assetGrid .asset-item').removeClass('selected');
            $(this).addClass('selected');
            console.log('Selected tree item:', $(this).find('span').text(), 'ID:', $(this).data('id'));
        }
    });
    
    $('#assetGrid').on('click', '.asset-item', function(e) {
        // Don't select if clicking on the delete button
        if ($(e.target).closest('.delete-btn').length === 0) {
            $('#assetTree li').removeClass('selected');
            $('#assetGrid .asset-item').removeClass('selected');
            $(this).addClass('selected');
            console.log('Selected grid item:', $(this).find('.asset-name').text(), 'ID:', $(this).data('id'));
        }
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

    // Function to make videos and iframes resizable
    function makeVideosResizable() {
        const $editor = $('.note-editable');
        
        // Find all videos and iframes in the editor
        $editor.find('iframe, video').each(function() {
            const $media = $(this);
            
            // Skip if already processed
            if ($media.hasClass('resizable-video-added')) return;
            
            // Mark as processed
            $media.addClass('resizable-video-added');
            
            // Create resize handles for all four corners
            const handles = ['nw', 'ne', 'sw', 'se'];
            const $container = $('<div class="video-resize-container"></div>').css({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
            });
            
            // Add wrapper to allow absolute positioning
            if (!$media.parent().hasClass('video-wrapper')) {
                $media.wrap('<div class="video-wrapper"></div>');
            }
            
            const $wrapper = $media.parent('.video-wrapper');
            $wrapper.css({
                position: 'relative',
                display: 'inline-block',
                width: $media.width(),
                height: $media.height()
            });
            
            $wrapper.append($container);
            
            // Add resize handles to each corner
            handles.forEach(handle => {
                const $handle = $('<div class="video-resize-handle"></div>');
                $handle.addClass('handle-' + handle).css({
                    position: 'absolute',
                    width: '10px',
                    height: '10px',
                    background: '#4285f4',
                    border: '1px solid #fff',
                    borderRadius: '50%',
                    pointerEvents: 'auto',
                    cursor: handle + '-resize',
                    zIndex: 10
                });
                
                // Position the handle
                if (handle.includes('n')) $handle.css('top', '-5px');
                if (handle.includes('s')) $handle.css('bottom', '-5px');
                if (handle.includes('w')) $handle.css('left', '-5px');
                if (handle.includes('e')) $handle.css('right', '-5px');
                
                $container.append($handle);
                
                // Add event listener for resize
                $handle.on('mousedown', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = $media.width();
                    const startHeight = $media.height();
                    const ratio = startWidth / startHeight;
                    const isNorth = handle.includes('n');
                    const isSouth = handle.includes('s');
                    const isWest = handle.includes('w');
                    const isEast = handle.includes('e');
                    
                    // Add overlay to capture mouse events
                    const $overlay = $('<div class="resize-overlay"></div>').css({
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        cursor: handle + '-resize',
                        zIndex: 9999
                    }).appendTo('body');
                    
                    $overlay.on('mousemove', function(e) {
                        let newWidth = startWidth;
                        let newHeight = startHeight;
                        
                        if (isEast || isWest) {
                            const diffX = isEast ? (e.clientX - startX) : (startX - e.clientX);
                            newWidth = Math.max(50, startWidth + diffX);
                            newHeight = newWidth / ratio;
                        } else if (isNorth || isSouth) {
                            const diffY = isSouth ? (e.clientY - startY) : (startY - e.clientY);
                            newHeight = Math.max(50, startHeight + diffY);
                            newWidth = newHeight * ratio;
                        }
                        
                        // Update media dimensions
                        $media.css({
                            width: newWidth + 'px',
                            height: newHeight + 'px'
                        });
                        
                        // Update wrapper dimensions
                        $wrapper.css({
                            width: newWidth + 'px',
                            height: newHeight + 'px'
                        });
                    });
                    
                    $overlay.on('mouseup', function() {
                        $overlay.remove();
                    });
                });
            });
        });
    }

    // Create plugin for video sizing
    $.extend($.summernote.plugins, {
        'videosize': function(context) {
            const ui = $.summernote.ui;
            const $editable = context.layoutInfo.editable;
            const options = context.options;
            const lang = options.langInfo;
            
            context.memo('button.videoSize100', function() {
                return ui.button({
                    contents: '<span class="note-fontsize-10">100%</span>',
                    tooltip: 'Full Size',
                    click: function() {
                        const $target = $(context.invoke('editor.restoreTarget'));
                        if ($target.is('iframe, video')) {
                            const $wrapper = $target.parent('.video-wrapper');
                            if ($wrapper.length) {
                                // Reset to original dimensions or set to 100%
                                $target.css({
                                    width: '100%',
                                    height: 'auto'
                                });
                                
                                $wrapper.css({
                                    width: '100%',
                                    height: 'auto'
                                });
                            }
                        }
                    }
                }).render();
            });
            
            context.memo('button.videoSize75', function() {
                return ui.button({
                    contents: '<span class="note-fontsize-10">75%</span>',
                    tooltip: '75% Size',
                    click: function() {
                        const $target = $(context.invoke('editor.restoreTarget'));
                        if ($target.is('iframe, video')) {
                            const $wrapper = $target.parent('.video-wrapper');
                            if ($wrapper.length) {
                                $target.css({
                                    width: '75%',
                                    height: 'auto'
                                });
                                
                                $wrapper.css({
                                    width: '75%',
                                    height: 'auto'
                                });
                            }
                        }
                    }
                }).render();
            });
            
            context.memo('button.videoSize50', function() {
                return ui.button({
                    contents: '<span class="note-fontsize-10">50%</span>',
                    tooltip: 'Half Size',
                    click: function() {
                        const $target = $(context.invoke('editor.restoreTarget'));
                        if ($target.is('iframe, video')) {
                            const $wrapper = $target.parent('.video-wrapper');
                            if ($wrapper.length) {
                                $target.css({
                                    width: '50%',
                                    height: 'auto'
                                });
                                
                                $wrapper.css({
                                    width: '50%',
                                    height: 'auto'
                                });
                            }
                        }
                    }
                }).render();
            });
        }
    });

    // Try to load data from session storage on page load
    const dataLoaded = assetStore.loadFromSessionStorage();
    
    if (dataLoaded) {
        // If we loaded data, render the tree
        assetStore.renderTree();
    } else {
        // If no data was found, initialize with a default empty structure
        console.log('No saved data found, starting with empty asset manager');
    }

    // Alternative approach using event delegation
    $(document).off('click', '#clearAllAssetsBtn').on('click', '#clearAllAssetsBtn', function() {
        if (confirm('Are you sure you want to clear ALL assets and folders? This cannot be undone.')) {
            assetStore.clearAll();
        }
    });
});

$(document).ready(function() {
    // Flag to prevent "no image selected" errors during operations
    var isImageLinkOperationInProgress = false;
    
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
                }
                
                // Load the current path
                const pathData = sessionStorage.getItem('assetManagerCurrentPath');
                if (pathData) {
                    this.currentPath = JSON.parse(pathData);
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
                // Store the current selection before any operations
                var currentSelection = window.getSelection();
                var hasSelection = currentSelection.rangeCount > 0;
                var selectionRange = hasSelection ? currentSelection.getRangeAt(0).cloneRange() : null;
                
                // Get the current selection to determine what's selected
                var selection = window.getSelection();
                var target = null;
                
                if (selection.rangeCount > 0) {
                    var range = selection.getRangeAt(0);
                    var commonAncestor = range.commonAncestorContainer;
                    
                    // Check if we have a direct image selection
                    if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
                        if (commonAncestor.tagName === 'IMG') {
                            target = commonAncestor;
                        } else if (commonAncestor.tagName === 'A' && commonAncestor.querySelector('img')) {
                            target = commonAncestor;
                        } else {
                            // Check if the selection contains an image
                            var imgElement = commonAncestor.querySelector('img');
                            if (imgElement) {
                                target = imgElement;
                            }
                        }
                    }
                    
                    // Also check if the selection is within an image
                    var imgParent = $(commonAncestor).closest('img');
                    if (imgParent.length > 0) {
                        target = imgParent[0];
                    }
                }
                
                // Fallback: try Summernote's restoreTarget
                if (!target) {
                    target = $('#summernote').summernote('restoreTarget');
                }
                
                // Debug logging
                console.log('LinkButton: target found:', target);
                console.log('LinkButton: target tagName:', target ? target.tagName : 'none');
                
                if (target && (target.tagName === 'IMG' || (target.tagName === 'A' && target.querySelector('img')))) {
                    // Image is selected (either directly or wrapped in a link), show image link options
                    console.log('LinkButton: showing image link modal');
                    showImageLinkModal(target);
                } else {
                    // Text is selected or nothing selected, show regular link options
                    // Store the selection in the modal's data for later use
                    $('#linkOptionsModal').data('selectionRange', selectionRange);
                    $('#linkOptionsModal').data('hasSelection', hasSelection);
                    
                    console.log('LinkButton: showing text link options modal');
                    $('#linkOptionsModal').modal('show');
                }
            }
        });
      
        return button.render();
    };

    // First, create a custom CodeViewButton that will replace the built-in codeview button
    var CodeViewButton = function (context) {
        var ui = $.summernote.ui;
      
        // Create a custom button that replaces the standard codeview button
        var button = ui.button({
            contents: '<i class="fas fa-code"/>',
            tooltip: 'View/Edit Code',
            click: function () {
                // When clicked, show our custom modal instead of toggling codeview
                showCodeViewModal();
            }
        });
      
        return button.render();
    };

    // Function to show the code view modal
    function showCodeViewModal() {
        // Get the current HTML content from the editor
        var htmlContent = $('#summernote').summernote('code');
        
        // Set the content to the code editor in the modal
        $('#codeViewTextarea').val(htmlContent);
        
        // Show the modal first
        $('#codeViewModal').modal('show');
        
        // Initialize or refresh CodeMirror after the modal is visible
        $('#codeViewModal').on('shown.bs.modal', function() {
            if (window.codeViewCodeMirror) {
                window.codeViewCodeMirror.setValue(htmlContent);
                window.codeViewCodeMirror.refresh();
            } else {
                window.codeViewCodeMirror = CodeMirror.fromTextArea(
                    document.getElementById('codeViewTextarea'), 
                    {
                        mode: 'htmlmixed',
                        theme: 'default',
                        lineNumbers: true,
                        lineWrapping: true,
                        matchBrackets: true,
                        autoCloseTags: true,
                        autoCloseBrackets: true,
                        styleActiveLine: true
                    }
                );
            }
            // Force a refresh after initialization
            setTimeout(function() {
                window.codeViewCodeMirror.refresh();
            }, 10);
        });
    }

    // Function to show the edit image modal
    function showEditImageModal() {
        // Get the currently selected image from Summernote
        var target = $('#summernote').summernote('restoreTarget');
        if (!target || target.tagName !== 'IMG') {
            alert('Please select an image first');
            return;
        }
        
        // Convert to jQuery object for easier manipulation
        var $target = $(target);
        
        // Store the target image's element reference and properties for later use
        // This way we can find the exact image even after the DOM is refreshed
        window.currentEditingImage = {
            element: target,  // Store the actual DOM element reference
            src: target.src,
            title: $target.attr('title') || '',
            width: $target.width(),
            height: $target.height()
        };
        
        // Get current image properties
        var currentTitle = $target.attr('title') || '';
        var currentWidth = $target.width();
        var currentHeight = $target.height();
        var originalWidth = target.naturalWidth;
        var originalHeight = target.naturalHeight;
        
        // Calculate aspect ratio
        var aspectRatio = originalWidth / originalHeight;
        
        // Populate the modal fields
        $('#editImageTitle').val(currentTitle);
        $('#editImageWidth').val(currentWidth);
        $('#editImageHeight').val(currentHeight);
        $('#editImageKeepAspectRatio').prop('checked', true);
        
        // Store aspect ratio for calculations
        $('#editImageModal').data('aspectRatio', aspectRatio);
        $('#editImageModal').data('originalWidth', originalWidth);
        $('#editImageModal').data('originalHeight', originalHeight);
        
        // Show the modal
        $('#editImageModal').modal('show');
    }

    // Function to show the image link modal
    function showImageLinkModal(targetElement) {
        var $target = $(targetElement);
        var $image, $link;
        
        // Determine if we have a direct image or a link-wrapped image
        if (targetElement.tagName === 'IMG') {
            // Direct image selection
            $image = $target;
            $link = $image.closest('a');
            // Store the actual DOM element reference for reliable identification
            window.currentLinkingImage = {
                element: targetElement,
                src: targetElement.src
            };
        } else if (targetElement.tagName === 'A' && targetElement.querySelector('img')) {
            // Link-wrapped image selection
            $link = $target;
            $image = $link.find('img')[0];
            // Store the actual DOM element reference for reliable identification
            window.currentLinkingImage = {
                element: $image,
                src: $image.src
            };
        } else {
            console.error('Invalid target for image link modal');
            return;
        }
        
        // Get current link properties
        var currentHref = $link.length > 0 ? $link.attr('href') || '' : '';
        var currentTarget = $link.length > 0 ? $link.attr('target') || '' : '';
        var currentTitle = $link.length > 0 ? $link.attr('title') || '' : '';
        
        // Populate the modal fields
        $('#imageLinkUrl').val(currentHref);
        $('#imageLinkTitle').val(currentTitle);
        $('#imageLinkNewWindow').prop('checked', currentTarget === '_blank');
        
        // Show/hide remove button based on whether link exists
        if ($link.length > 0) {
            $('#removeImageLinkBtn').show();
            $('#applyImageLinkBtn').text('Update Link');
        } else {
            $('#removeImageLinkBtn').hide();
            $('#applyImageLinkBtn').text('Add Link');
        }
        
        // Show the modal
        $('#imageLinkModal').modal('show');
    }

    // Simple function to find a specific image using a unique identifier
    function findSpecificImage(imageInfo) {
        if (!imageInfo || !imageInfo.element) {
            return null;
        }
        
        // First, try to find images with the same src
        var $candidates = $('.note-editable img[src="' + imageInfo.src + '"]');
        

        
        if ($candidates.length === 0) {
            return null;
        }
        
        if ($candidates.length === 1) {
            // Only one image with this src, return it

            return $candidates;
        }
        
        // Multiple images with same src - use the stored DOM element reference
        // This is the most reliable way since it's the actual element that was selected

        
        // Check if our stored element is still in the DOM
        if (document.contains(imageInfo.element)) {

            return $(imageInfo.element);
        }
        
        // If the stored element is no longer in the DOM (e.g., after content refresh),
        // we need to find it by looking at the surrounding content

        
        // Find the image that's in the same position relative to other content
        // We'll use a simple approach: find the image that has the most similar surrounding text
        var bestMatch = null;
        var bestContextMatch = 0;
        
        for (var i = 0; i < $candidates.length; i++) {
            var $candidate = $($candidates[i]);
            var candidate = $candidate[0];
            
            // Get text content around this candidate
            var $parent = $candidate.parent();
            var parentText = $parent.text().trim();
            
            // Simple context matching: check if this candidate's parent has similar content
            // to what we might expect based on the original selection
            if (parentText.length > 0) {
                var contextMatch = 0;
                
                // If this is the first candidate, give it a slight advantage
                if (i === 0) contextMatch += 0.1;
                
                // Check if this candidate is in a paragraph (common for images)
                if ($parent.is('p')) contextMatch += 0.2;
                
                // Check if this candidate is wrapped in a link (if we're editing links)
                if ($candidate.closest('a').length > 0) contextMatch += 0.1;
                
                if (contextMatch > bestContextMatch) {
                    bestContextMatch = contextMatch;
                    bestMatch = $candidate;
                }
            }
        }
        
        if (bestMatch) {

            return bestMatch;
        }
        
        // Last resort: return the first candidate

        return $($candidates[0]);
    }

    // Edit Image Button for Popover
    var EditImageButton = function (context) {
        var ui = $.summernote.ui;
        
        var button = ui.button({
            contents: '<i class="fas fa-edit"></i> Edit',
            tooltip: 'Edit Image',
            click: function () {
                showEditImageModal();
            }
        });
        
        return button.render();
    };

    // Custom Alignment Dropdown Button
    var CustomAlignDropdown = function (context) {
        var ui = $.summernote.ui;
        var alignments = [
            { cmd: 'justifyLeft', icon: 'fa-align-left', label: 'Left Align' },
            { cmd: 'justifyCenter', icon: 'fa-align-center', label: 'Center Align' },
            { cmd: 'justifyRight', icon: 'fa-align-right', label: 'Right Align' },
            { cmd: 'justifyFull', icon: 'fa-align-justify', label: 'Justify Align' },
            { divider: true },
            { cmd: 'outdent', icon: 'fa-outdent', label: 'Outdent' },
            { cmd: 'indent', icon: 'fa-indent', label: 'Indent' }
        ];

        // Helper to get current alignment
        function getCurrentAlign() {
            var $focus = $(window.getSelection().focusNode).closest('p, h1, h2, h3, h4, h5, h6, div, blockquote, pre');
            if ($focus.length) {
                var align = $focus.css('text-align');
                switch (align) {
                    case 'center': return 'justifyCenter';
                    case 'right': return 'justifyRight';
                    case 'justify': return 'justifyFull';
                    case 'left': return 'justifyLeft';
                    default: return 'justifyLeft';
                }
            }
            return 'justifyLeft';
        }

        // Helper to get label/icon for current alignment
        function getAlignMeta(cmd) {
            return alignments.find(a => a.cmd === cmd) || alignments[0];
        }

        // Create dropdown menu
        var $dropdown = $('<div class="dropdown-menu custom-align-dropdown"></div>');
        alignments.forEach(function(a) {
            if (a.divider) {
                $dropdown.append('<div class="dropdown-divider"></div>');
            } else {
                $dropdown.append('<a class="dropdown-item align-option" href="#" data-cmd="' + a.cmd + '"><i class="fas ' + a.icon + '"></i> ' + a.label + '</a>');
            }
        });

        // Create button with Bootstrap dropdown
        var currentCmd = getCurrentAlign();
        var meta = getAlignMeta(currentCmd);
        var $button = $('<button type="button" class="note-btn btn btn-light dropdown-toggle align-dropdown-btn" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" title="Alignment">'
            + '<span class="align-btn-label"><i class="fas ' + meta.icon + '"></i> <span>' + meta.label + '</span></span>'
            + '</button>');

        var $group = $('<div class="note-btn-group btn-group note-align-dropdown-group"></div>');
        $group.append($button).append($dropdown);

        // Return as HTML string for Summernote
        return $group[0].outerHTML;
    };

    // Initialize Summernote
    $('#summernote').summernote({
        disableDragAndDrop: true,
        buttons: {
            assetManager: AssetManagerButton,
            linkCustom: LinkButton,
            codeViewCustom: CodeViewButton,
            customAlignDropdown: CustomAlignDropdown,
            editImage: EditImageButton
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
            ['para', ['customAlignDropdown']],
            ['height', ['height']],
            ['table', ['table']],
            ['insert', ['linkCustom', 'picture', 'video', 'assetManager']],
            ['misc', ['codeViewCustom']],
            ['view', ['fullscreen']],
            ['history', ['undo', 'redo']]
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
                ['edit', ['editImage']],
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
            callbacks: {
                onKeydown: function(e) {
                    if ((e.keyCode === 46 || e.keyCode === 8) && selectedImage) {
                        e.preventDefault();
                        $(selectedImage).remove();
                        selectedImage = null;
                    }
                },
            },
            onInit: function() {
                setTimeout(function() {
                    makeTablesResizable();
                    makeVideosResizable();
                }, 100);

                // Initialize style dropdown with default value
                updateStyleDropdown('p');

                // Add event listener for style changes
                $('.note-style .dropdown-menu a').on('click', function() {
                    const tagName = $(this).data('value');
                    setTimeout(function() {
                        updateStyleDropdown(tagName);
                    }, 0);
                });

                // Event delegation for align dropdown
                $(document).off('click', '.note-align-dropdown-group .align-option').on('click', '.note-align-dropdown-group .align-option', function(e) {
                    e.preventDefault();
                    var cmd = $(this).data('cmd');
                    $('#summernote').summernote('focus');
                    if (cmd === 'outdent' || cmd === 'indent') {
                        document.execCommand(cmd);
                    } else {
                        document.execCommand(cmd, false, null);
                    }
                    // Update button label/icon
                    var alignments = [
                        { cmd: 'justifyLeft', icon: 'fa-align-left', label: 'Left Align' },
                        { cmd: 'justifyCenter', icon: 'fa-align-center', label: 'Center Align' },
                        { cmd: 'justifyRight', icon: 'fa-align-right', label: 'Right Align' },
                        { cmd: 'justifyFull', icon: 'fa-align-justify', label: 'Justify Align' }
                    ];
                    var meta = alignments.find(a => a.cmd === cmd) || alignments[0];
                    var $button = $(this).closest('.note-align-dropdown-group').find('.align-dropdown-btn');
                    $button.find('.align-btn-label').html('<i class=\"fas ' + meta.icon + '\"></i> <span>' + meta.label + '</span>');
                    // Close the dropdown
                    $button.dropdown('toggle');
                });
                // Update button on selection change
                $(document).off('selectionchange.alignDropdown').on('selectionchange.alignDropdown', function() {
                    var $button = $('.note-align-dropdown-group .align-dropdown-btn');
                    var $focus = $(window.getSelection().focusNode).closest('p, h1, h2, h3, h4, h5, h6, div, blockquote, pre');
                    var align = $focus.length ? $focus.css('text-align') : 'left';
                    var alignments = [
                        { cmd: 'justifyLeft', icon: 'fa-align-left', label: 'Left Align' },
                        { cmd: 'justifyCenter', icon: 'fa-align-center', label: 'Center Align' },
                        { cmd: 'justifyRight', icon: 'fa-align-right', label: 'Right Align' },
                        { cmd: 'justifyFull', icon: 'fa-align-justify', label: 'Justify Align' }
                    ];
                    var cmd = 'justifyLeft';
                    switch (align) {
                        case 'center': cmd = 'justifyCenter'; break;
                        case 'right': cmd = 'justifyRight'; break;
                        case 'justify': cmd = 'justifyFull'; break;
                        case 'left': cmd = 'justifyLeft'; break;
                    }
                    var meta = alignments.find(a => a.cmd === cmd) || alignments[0];
                    $button.find('.align-btn-label').html('<i class=\"fas ' + meta.icon + '\"></i> <span>' + meta.label + '</span>');
                });
            },
            onChange: function(contents, $editable) {
                // When content changes, check for new elements and make them resizable
                makeTablesResizable();
                makeVideosResizable();
            },
            onKeyup: function(e) {
                updateStyleDropdownFromSelection();
            },
            onMouseup: function(e) {
                updateStyleDropdownFromSelection();
            }
        }
    });

    // Fix for image duplication on drag-and-drop inside Summernote
$('#summernote').on('dragstart', 'img', function(e) {
    $(this).addClass('dragging-image');
});

$('#summernote').on('dragend', 'img', function(e) {
    $(this).removeClass('dragging-image');
});

$('#summernote').on('drop', function(e) {
    const dataTransfer = e.originalEvent.dataTransfer;

    // If it's not an actual file being dropped, assume it's internal drag
    if (dataTransfer && dataTransfer.files.length === 0) {
        e.preventDefault();
        e.stopPropagation();

        const draggingImg = document.querySelector('.dragging-image');
        if (draggingImg) {
            const range = window.getSelection().getRangeAt(0);
            range.deleteContents();
            range.insertNode(draggingImg);
            draggingImg.classList.remove('dragging-image');
        }
    }
});

let selectedImage = null;

// When user clicks an image inside the editor
$('#summernote').on('click', 'img', function(e) {
    selectedImage = this;
});

// When user clicks anywhere else in the editor
$('#summernote').on('click', function(e) {
    if (!$(e.target).is('img')) {
        selectedImage = null;
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
    $('#manualLinkBtn').off('click').on('click', function() {
        // Prevent multiple clicks
        if ($(this).hasClass('processing')) {
            return;
        }
        $(this).addClass('processing');
        
        // Store the current selection before closing the modal
        var currentSelection = window.getSelection();
        var hasSelection = currentSelection.rangeCount > 0;
        var selectionRange = hasSelection ? currentSelection.getRangeAt(0).cloneRange() : null;
        
        // Close our modal
        $('#linkOptionsModal').modal('hide');
        
        // Show our custom text link modal instead of trying to trigger Summernote's native dialog
        setTimeout(function() {
            // Check if modal is already open
            if ($('#textLinkModal').hasClass('show')) {
                console.log('Text Link Modal: Already open, not opening again');
                $('#manualLinkBtn').removeClass('processing');
                return;
            }
            
            // Store the selection in the modal's data for later use
            $('#textLinkModal').data('selectionRange', selectionRange);
            $('#textLinkModal').data('hasSelection', hasSelection);
            
            // Pre-populate the text field with any selected text
            var selectedText = '';
            if (hasSelection) {
                selectedText = currentSelection.toString().trim();
            }
            
            // Set the text field value
            $('#textLinkText').val(selectedText);
            
            // Show the modal
            $('#textLinkModal').modal('show');
            
            // Remove processing class after modal is shown
            setTimeout(function() {
                $('#manualLinkBtn').removeClass('processing');
            }, 200);
        }, 100);  // Small delay to ensure our modal is closed first
    });

    $('#assetLinkBtn').off('click').on('click', function() {
        // Get the stored selection from the modal
        var selectionRange = $('#linkOptionsModal').data('selectionRange');
        var hasSelection = $('#linkOptionsModal').data('hasSelection');
        
        // Store the selection in the asset manager modal for later use
        $('#assetManagerModal').data('selectionRange', selectionRange);
        $('#assetManagerModal').data('hasSelection', hasSelection);
        $('#assetManagerModal').data('mode', 'link');
        
        // Close our modal
        $('#linkOptionsModal').modal('hide');
        
        // Open the asset manager with link mode
        $('#assetManagerModal').modal('show');
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

    $('#selectAssetBtn').off('click').on('click', function() {
        let selectedId;
        
        // Check which view is active and get the selected item
        if ($('#gridViewBtn').hasClass('active')) {
            const selected = $('#assetGrid .asset-item.selected');
            if (selected.length) {
                selectedId = selected.data('id');
            }
        } else {
            const selected = $('#assetTree li.selected');
            if (selected.length) {
                selectedId = selected.data('id');
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
        
        // Convert selectedId to string to ensure consistent comparison
        const item = currentFolder.children.find(
            child => String(child.id) === String(selectedId)
        );
        
        if (!item) {
            console.error('Item not found for ID:', selectedId);
            return;
        }
        
        if (item.type === 'folder') {
            alert('Please select a file, not a folder');
            return;
        }
        
        // Now we're sure this is a file and we found it
        const mode = $('#assetManagerModal').data('mode') || 'insert';
        
        if (mode === 'link') {
            // For link dialog - we need to create the link at the correct position
            var selectionRange = $('#assetManagerModal').data('selectionRange');
            var hasSelection = $('#assetManagerModal').data('hasSelection');
            
            // Close the modal first
            $('#assetManagerModal').modal('hide');
            
            // Create the link at the correct position
            setTimeout(function() {
                if (hasSelection && selectionRange) {
                    // Restore the selection
                    var selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(selectionRange);
                    
                    // Create the link at the selected position
                    $('#summernote').summernote('createLink', {
                        text: item.name,
                        url: item.data,
                        isNewWindow: true
                    });
                } else {
                    // No selection, create link at cursor position
                    $('#summernote').summernote('createLink', {
                        text: item.name,
                        url: item.data,
                        isNewWindow: true
                    });
                }
            }, 100);
            
            return; // Exit early since we handled the link creation
        } else {
            // Direct insert - HANDLE ONLY ONE INSERT TYPE
            if (item.mimeType && item.mimeType.startsWith('image/')) {
                // Insert image directly into the editor
                const image = $('<img>')
                    .attr('src', item.data)
                    .attr('alt', item.name)
                    .css('max-width', '100%');
                
                $('#summernote').summernote('insertNode', image[0]);
            } else {
                // Insert as a link
                $('#summernote').summernote('createLink', {
                    text: item.name,
                    url: item.data,
                    isNewWindow: true
                });
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
        }
    });
    
    $('#assetGrid').on('click', '.asset-item', function(e) {
        // Don't select if clicking on the delete button
        if ($(e.target).closest('.delete-btn').length === 0) {
            $('#assetTree li').removeClass('selected');
            $('#assetGrid .asset-item').removeClass('selected');
            $(this).addClass('selected');
        }
    });

    // Initialize on modal show
    $('#assetManagerModal').on('show.bs.modal', function() {
        // Default to grid view
        $('#gridViewBtn').addClass('active');
        $('#listViewBtn').removeClass('active');
        $('#assetGrid').show();
        $('#assetTree').hide();
        
        // Clear any previously selected items
        $('#assetGrid .asset-item').removeClass('selected');
        $('#assetTree li').removeClass('selected');
        
        assetStore.renderTree();
    }).on('hidden.bs.modal', () => {
        // Reset mode when modal is closed
        $('#assetManagerModal').removeData('mode');
    });

    // Add resize handle to the editor
    const $editor = $('.note-editor');
    const $editable = $('.note-editable');
    
    if ($editor.length && $editable.length) {
        
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

    // Add the code view modal HTML to the page
    const codeViewModal = `
    <div class="modal fade" id="codeViewModal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">HTML Code View</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <textarea id="codeViewTextarea" style="width: 100%; height: 400px;"></textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="applyCodeBtn">Apply Changes</button>
                </div>
                <div class="modal-resize-handle"></div>
            </div>
        </div>
    </div>
    `;

    // Add the edit image modal HTML to the page
    const editImageModal = `
    <div class="modal fade" id="editImageModal" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Image</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="editImageForm">
                        <div class="form-group">
                            <label for="editImageTitle">Image Title</label>
                            <input type="text" class="form-control" id="editImageTitle" placeholder="Enter image title...">
                        </div>
                        <div class="form-group">
                            <label for="editImageWidth">Width (px)</label>
                            <input type="number" class="form-control" id="editImageWidth" min="1" placeholder="Width">
                        </div>
                        <div class="form-group">
                            <label for="editImageHeight">Height (px)</label>
                            <input type="number" class="form-control" id="editImageHeight" min="1" placeholder="Height">
                        </div>
                        <div class="form-group">
                            <div class="custom-control custom-checkbox">
                                <input type="checkbox" class="custom-control-input" id="editImageKeepAspectRatio" checked>
                                <label class="custom-control-label" for="editImageKeepAspectRatio">
                                    Keep aspect ratio
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="applyImageEditBtn">Apply Changes</button>
                </div>
            </div>
        </div>
    </div>
    `;

    // Add the image link modal HTML to the page
    const imageLinkModal = `
    <div class="modal fade" id="imageLinkModal" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Link Image</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="imageLinkForm">
                        <div class="form-group">
                            <label for="imageLinkUrl">URL</label>
                            <input type="url" class="form-control" id="imageLinkUrl" placeholder="Enter URL (e.g., https://example.com)">
                        </div>
                        <div class="form-group">
                            <label for="imageLinkTitle">Link Title (tooltip)</label>
                            <input type="text" class="form-control" id="imageLinkTitle" placeholder="Enter title for tooltip...">
                        </div>
                        <div class="form-group">
                            <div class="custom-control custom-checkbox">
                                <input type="checkbox" class="custom-control-input" id="imageLinkNewWindow">
                                <label class="custom-control-label" for="imageLinkNewWindow">
                                    Open in new window/tab
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="removeImageLinkBtn">Remove Link</button>
                    <button type="button" class="btn btn-primary" id="applyImageLinkBtn">Apply Link</button>
                </div>
            </div>
        </div>
    </div>
    `;

    // Append the modals to the body
    $('body').append(codeViewModal);
    $('body').append(editImageModal);
    $('body').append(imageLinkModal);
    
    // Add a fallback text link modal for when Summernote's native dialog fails
    const textLinkModal = `
    <div class="modal fade" id="textLinkModal" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Insert Text Link</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="textLinkForm">
                        <div class="form-group">
                            <label for="textLinkUrl">URL</label>
                            <input type="url" class="form-control" id="textLinkUrl" placeholder="Enter URL (e.g., https://example.com)" required>
                        </div>
                        <div class="form-group">
                            <label for="textLinkText">Link Text</label>
                            <input type="text" class="form-control" id="textLinkText" placeholder="Enter link text..." required>
                        </div>
                        <div class="form-group">
                            <div class="custom-control custom-checkbox">
                                <input type="checkbox" class="custom-control-input" id="textLinkNewWindow">
                                <label class="custom-control-label" for="textLinkNewWindow">
                                    Open in new window/tab
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="applyTextLinkBtn">Insert Link</button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    $('body').append(textLinkModal);
    
    // Add event handlers for the edit image modal
    $('#editImageModal').on('show.bs.modal', function() {
        // Modal opening - no action needed
    });
    
    $('#editImageModal').on('hidden.bs.modal', function() {
        // Clear the stored image reference when modal is actually closed
        window.currentEditingImage = null;
    });

    // Add event handlers for the image link modal
    $('#imageLinkModal').on('show.bs.modal', function() {
    });
    
    $('#imageLinkModal').on('hidden.bs.modal', function() {
        // Only clear if no operation is in progress
        if (!isImageLinkOperationInProgress) {
            window.currentLinkingImage = null;
        }
        // Reset the flag
        isImageLinkOperationInProgress = false;
    });
    
    // Add event handlers for the text link modal
    $('#textLinkModal').off('show.bs.modal hidden.bs.modal').on('show.bs.modal', function() {
        console.log('Text Link Modal: Opening modal');
        
        // Clear any previous values when modal opens
        $('#textLinkUrl').val('');
        $('#textLinkNewWindow').prop('checked', false);
        
        // Debug: Check if form fields exist
        console.log('Text Link Modal: URL field exists:', $('#textLinkUrl').length > 0);
        console.log('Text Link Modal: Text field exists:', $('#textLinkText').length > 0);
        
        // Focus on the URL field
        setTimeout(function() {
            $('#textLinkUrl').focus();
        }, 150);
    });
    
    $('#textLinkModal').on('hidden.bs.modal', function() {
        // Clear the form when modal is closed
        $('#textLinkForm')[0].reset();
    });

    // Add resize functionality to the code view modal
    $('#codeViewModal').on('shown.bs.modal', function() {
        const $modal = $(this);
        const $modalDialog = $modal.find('.modal-dialog');
        const $modalContent = $modal.find('.modal-content');
        const $resizeHandle = $modal.find('.modal-resize-handle');
        
        // Set initial size
        $modalDialog.css({
            'width': '80%',
            'max-width': 'none',
            'height': '80vh',
            'margin': '10vh auto'
        });
        
        // Add resize handle event listeners
        $resizeHandle.on('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = $modalDialog.width();
            const startHeight = $modalDialog.height();
            
            // Add overlay to capture mouse events
            const $overlay = $('<div class="resize-overlay"></div>').css({
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                cursor: 'se-resize',
                zIndex: 9999
            }).appendTo('body');
            
            $overlay.on('mousemove', function(e) {
                const newWidth = Math.max(400, startWidth + (e.clientX - startX));
                const newHeight = Math.max(300, startHeight + (e.clientY - startY));
                
                $modalDialog.css({
                    width: newWidth + 'px',
                    height: newHeight + 'px'
                });
                
                // Update CodeMirror size
                if (window.codeViewCodeMirror) {
                    window.codeViewCodeMirror.refresh();
                }
            });
            
            $overlay.on('mouseup', function() {
                $overlay.remove();
            });
        });
    });

    // Handle applying code changes when the Apply button is clicked
    $('#applyCodeBtn').click(function() {
        // Get the updated code from CodeMirror or the textarea
        let updatedCode;
        if (window.codeViewCodeMirror) {
            updatedCode = window.codeViewCodeMirror.getValue();
        } else {
            updatedCode = $('#codeViewTextarea').val();
        }
        
        // Update the editor content with the new code
        $('#summernote').summernote('code', updatedCode);
        
        // Close the modal
        $('#codeViewModal').modal('hide');
    });

    // Handle applying image edits when the Apply button is clicked
    $('#applyImageEditBtn').click(function() {
        // Prevent multiple clicks
        if ($(this).hasClass('processing')) {
            return;
        }
        
        if (!window.currentEditingImage || !window.currentEditingImage.src) {
            alert('No image selected for editing');
            return;
        }
        
        // Mark as processing to prevent multiple clicks
        $(this).addClass('processing').prop('disabled', true);
        
        // Find the specific image using the stored element reference
        var $image = null;
        
        // Debug logging
        console.log('Edit Image: Stored element exists:', !!window.currentEditingImage.element);
        console.log('Edit Image: Stored element in DOM:', window.currentEditingImage.element ? document.contains(window.currentEditingImage.element) : false);
        console.log('Edit Image: Stored dimensions:', window.currentEditingImage.width + 'x' + window.currentEditingImage.height);
        
        // First, try to use the stored DOM element reference (most reliable)
        if (window.currentEditingImage.element && document.contains(window.currentEditingImage.element)) {
            $image = $(window.currentEditingImage.element);
            console.log('Edit Image: Using stored DOM element reference');
        }
        
        // If the stored element is no longer in the DOM, fall back to finding by src
        if (!$image || $image.length === 0) {
            var $candidates = $('.note-editable img[src="' + window.currentEditingImage.src + '"]');
            console.log('Edit Image: Found', $candidates.length, 'images with same src');
            
            if ($candidates.length === 1) {
                // Only one image with this src, use it
                $image = $candidates;
                console.log('Edit Image: Using single image found by src');
            } else if ($candidates.length > 1) {
                // Multiple images with same src - try to find the one with matching dimensions
                var targetWidth = window.currentEditingImage.width;
                var targetHeight = window.currentEditingImage.height;
                
                $image = $candidates.filter(function() {
                    return Math.abs($(this).width() - targetWidth) < 5 && 
                           Math.abs($(this).height() - targetHeight) < 5;
                });
                
                console.log('Edit Image: Found', $image.length, 'images with matching dimensions');
                
                // If still multiple matches, use the first one and log a warning
                if ($image.length > 1) {
                    console.warn('Multiple images with same src and dimensions found. Using first match.');
                    $image = $image.first();
                }
            }
        }
        
        var newTitle = $('#editImageTitle').val();
        var newWidth = parseInt($('#editImageWidth').val());
        var newHeight = parseInt($('#editImageHeight').val());
        var keepAspectRatio = $('#editImageKeepAspectRatio').is(':checked');
        
        // Validate inputs
        if (isNaN(newWidth) || newWidth <= 0) {
            alert('Please enter a valid width');
            $(this).removeClass('processing').prop('disabled', false);
            return;
        }
        if (isNaN(newHeight) || newHeight <= 0) {
            alert('Please enter a valid height');
            $(this).removeClass('processing').prop('disabled', false);
            return;
        }
        
        // Only proceed if we found an image to edit
        if ($image && $image.length > 0) {
            // Update the image properties
            $image.attr('title', newTitle);
            $image.css({
                'width': newWidth + 'px',
                'height': newHeight + 'px'
            });
            
            // Force Summernote to refresh its UI and selection by triggering a change event
            $('#summernote').summernote('code', $('#summernote').summernote('code'));
            
            console.log('Edit Image: Successfully updated image dimensions');
        } else {
            console.warn('Edit Image: Could not find the selected image to edit');
        }
        
        // Close the modal first
        $('#editImageModal').modal('hide');
        
        // Reset button state
        $(this).removeClass('processing').prop('disabled', false);
    });

    // Handle aspect ratio preservation when width or height changes
    $('#editImageWidth, #editImageHeight').on('input', function() {
        var keepAspectRatio = $('#editImageKeepAspectRatio').is(':checked');
        if (!keepAspectRatio) return;
        
        var aspectRatio = $('#editImageModal').data('aspectRatio');
        if (!aspectRatio) return;
        
        var changedField = $(this).attr('id');
        var newValue = parseInt($(this).val());
        
        if (isNaN(newValue) || newValue <= 0) return;
        
        if (changedField === 'editImageWidth') {
            // Calculate new height based on width
            var newHeight = Math.round(newValue / aspectRatio);
            $('#editImageHeight').val(newHeight);
        } else if (changedField === 'editImageHeight') {
            // Calculate new width based on height
            var newWidth = Math.round(newValue * aspectRatio);
            $('#editImageWidth').val(newWidth);
        }
    });

    // Handle aspect ratio checkbox change
    $('#editImageKeepAspectRatio').on('change', function() {
        var isChecked = $(this).is(':checked');
        if (isChecked) {
            // Recalculate based on current width
            var currentWidth = parseInt($('#editImageWidth').val());
            var aspectRatio = $('#editImageModal').data('aspectRatio');
            if (currentWidth && aspectRatio) {
                var newHeight = Math.round(currentWidth / aspectRatio);
                $('#editImageHeight').val(newHeight);
            }
        }
    });

    // Handle applying text links when the Apply button is clicked
    $('#applyTextLinkBtn').off('click').on('click', function() {
        // Prevent multiple clicks
        if ($(this).hasClass('processing')) {
            return;
        }
        $(this).addClass('processing');
        
        var url = $('#textLinkUrl').val().trim();
        var text = $('#textLinkText').val().trim();
        var newWindow = $('#textLinkNewWindow').is(':checked');
        
        // Debug logging
        console.log('Text Link Modal - URL field value:', url);
        console.log('Text Link Modal - Text field value:', text);
        console.log('Text Link Modal - New window checked:', newWindow);
        
        if (!url) {
            alert('Please enter a URL');
            $(this).removeClass('processing');
            return;
        }
        
        if (!text) {
            alert('Please enter link text');
            $(this).removeClass('processing');
            return;
        }
        
        // Get the stored selection from the modal
        var selectionRange = $('#textLinkModal').data('selectionRange');
        var hasSelection = $('#textLinkModal').data('hasSelection');
        
        // Close the modal first
        $('#textLinkModal').modal('hide');
        
        // Clear the form
        $('#textLinkForm')[0].reset();
        
        // Remove processing class
        $(this).removeClass('processing');
        
        // Now create the link at the correct position
        setTimeout(function() {
            if (hasSelection && selectionRange) {
                // Restore the selection
                var selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(selectionRange);
                
                // Create the link at the selected position
                $('#summernote').summernote('createLink', {
                    text: text,
                    url: url,
                    isNewWindow: newWindow
                });
            } else {
                // No selection, create link at cursor position
                $('#summernote').summernote('createLink', {
                    text: text,
                    url: url,
                    isNewWindow: newWindow
                });
            }
        }, 100);
    });

    // Handle applying image links when the Apply button is clicked
    $('#applyImageLinkBtn').click(function() {
        // Set flag to prevent errors during operation
        isImageLinkOperationInProgress = true;
        
        if (!window.currentLinkingImage) {
            alert('No image selected for linking');
            isImageLinkOperationInProgress = false;
            return;
        }
        
        var url = $('#imageLinkUrl').val().trim();
        var title = $('#imageLinkTitle').val().trim();
        var newWindow = $('#imageLinkNewWindow').is(':checked');
        
        if (!url) {
            alert('Please enter a URL');
            return;
        }
        
        // Find the specific image using multiple identifiers to avoid affecting duplicate images
        var $image = findSpecificImage(window.currentLinkingImage);
        if (!$image || $image.length === 0) {
            alert('Could not find the selected image');
            return;
        }
        
        // Check if the image already has a link
        var $existingLink = $image.closest('a');
        
        if ($existingLink.length > 0) {
            // Update existing link
            $existingLink.attr({
                'href': url,
                'title': title
            });
            
            if (newWindow) {
                $existingLink.attr('target', '_blank');
            } else {
                $existingLink.removeAttr('target');
            }
        } else {
            // Create new link
            var $link = $('<a>').attr({
                'href': url,
                'title': title
            });
            
            if (newWindow) {
                $link.attr('target', '_blank');
            }
            
            // Wrap the image in the link
            $image.wrap($link);
        }
        
        // Store the image src for cleanup
        var imageSrc = window.currentLinkingImage.src;
        
        // Close the modal first
        $('#imageLinkModal').modal('hide');
        
        // Clear the stored image reference after modal starts closing
        setTimeout(function() {
            window.currentLinkingImage = null;
        }, 100);
    });

    // Handle removing image links
    $('#removeImageLinkBtn').click(function() {
        // Set flag to prevent errors during operation
        isImageLinkOperationInProgress = true;
        
        if (!window.currentLinkingImage) {
            alert('No image selected');
            isImageLinkOperationInProgress = false;
            return;
        }
        
        // Find the specific image using multiple identifiers to avoid affecting duplicate images
        var $image = findSpecificImage(window.currentLinkingImage);
        if (!$image || $image.length === 0) {
            alert('Could not find the selected image');
            return;
        }
        
        // Check if the image is wrapped in a link
        var $link = $image.closest('a');
        if ($link.length > 0) {
            // Unwrap the image from the link
            $image.insertBefore($link);
            $link.remove();
            
            // Clear the form fields
            $('#imageLinkUrl').val('');
            $('#imageLinkTitle').val('');
            $('#imageLinkNewWindow').prop('checked', false);
            
            // Update button text and hide remove button
            $('#applyImageLinkBtn').text('Add Link');
            $('#removeImageLinkBtn').hide();
        }
        
        // Clear the stored image reference first
        window.currentLinkingImage = null;
        
        // Close the modal
        $('#imageLinkModal').modal('hide');
    });

    // Function to update style dropdown based on selection
    function updateStyleDropdownFromSelection() {
        const $editable = $('.note-editable');
        const selection = window.getSelection();
        
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const node = range.commonAncestorContainer;
            
            // Get the closest block element
            let blockElement = $(node).closest('p, h1, h2, h3, h4, h5, h6, blockquote, pre');
            
            // If no block element found, try to get the parent element
            if (!blockElement.length) {
                blockElement = $(node).parent();
            }
            
            // Get the tag name and update the dropdown
            const tagName = blockElement.prop('tagName').toLowerCase();
            updateStyleDropdown(tagName);
        }
    }

    // Function to update style dropdown text
    function updateStyleDropdown(tagName) {
        const $styleBtn = $('.note-style .note-btn');
        const $styleText = $styleBtn.find('.note-current-style');
        
        if (!$styleText.length) {
            $styleBtn.prepend('<span class="note-current-style"></span>');
        }
        
        const styleText = getStyleText(tagName);
        $styleBtn.find('.note-current-style').text(styleText);
    }

    // Function to get display text for style
    function getStyleText(tagName) {
        const styleMap = {
            'p': 'Normal',
            'h1': 'Heading 1',
            'h2': 'Heading 2',
            'h3': 'Heading 3',
            'h4': 'Heading 4',
            'h5': 'Heading 5',
            'h6': 'Heading 6',
            'blockquote': 'Quote',
            'pre': 'Code'
        };
        
        return styleMap[tagName] || 'Normal';
    }
});

/**
 * Asset Manager Module
 * Handles file and folder management with session storage
 */
const AssetManager = (function() {
    'use strict';
    
    // Private variables
    let assetStore = {
        root: {
            name: 'Root',
            type: 'folder',
            children: []
        },
        currentPath: ['root'],
        
        // Session storage methods
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
    
    // Public API
    return {
        // Initialize the asset manager
        init: function() {
            // Try to load data from session storage on page load
            const dataLoaded = assetStore.loadFromSessionStorage();
            
            if (dataLoaded) {
                // If we loaded data, render the tree
                assetStore.renderTree();
            } else {
                // If no data was found, initialize with a default empty structure
                console.log('No saved data found, starting with empty asset manager');
            }
            
            this.bindEvents();
        },
        
        // Bind event handlers
        bindEvents: function() {
            // Asset Manager Event Handlers
            $('#createFolderBtn').off('click').on('click', function() {
                const folderName = prompt('Enter folder name:');
                if (folderName) {
                    assetStore.addFolder(folderName);
                }
            });
            
            // Upload button click handler
            $('#uploadBtn').off('click').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Reset the input and trigger file selection dialog
                const fileInput = $('#assetUpload')[0];
                fileInput.value = '';
                fileInput.click();
            });

            // File input change handler
            $('#assetUpload').off('change').on('change', function(e) {
                e.preventDefault();
                
                const files = e.target.files;
                if (files && files.length > 0) {
                    Array.from(files).forEach(file => {
                        assetStore.addFile(file);
                    });
                }
            });
            
            // View toggle buttons
            $('#listViewBtn').off('click').on('click', function() {
                $(this).addClass('active');
                $('#gridViewBtn').removeClass('active');
                $('#assetGrid').hide();
                $('#assetTree').show();
            });
            
            $('#gridViewBtn').off('click').on('click', function() {
                $(this).addClass('active');
                $('#listViewBtn').removeClass('active');
                $('#assetTree').hide();
                $('#assetGrid').show();
            });
            
            // Asset selection for linking
            $(document).off('click', '.asset-item').on('click', '.asset-item', function() {
                const selectedId = $(this).attr('data-id');
                
                if (selectedId === 'back') {
                    return; // Don't select the back button
                }
                
                // Remove previous selection
                $('.asset-item').removeClass('selected');
                $(this).addClass('selected');
                
                // Find the selected item in the current folder
                const currentFolder = assetStore.getCurrentFolder();
                
                // Convert selectedId to string to ensure consistent comparison
                const item = currentFolder.children.find(
                    child => String(child.id) === String(selectedId)
                );
                
                if (item && item.type === 'file') {
                    // Store the selected asset for use in modals
                    window.selectedAsset = item;
                }
            });
            
            // Clear all assets button
            $(document).off('click', '#clearAllAssetsBtn').on('click', '#clearAllAssetsBtn', function() {
                if (confirm('Are you sure you want to clear ALL assets and folders? This cannot be undone.')) {
                    assetStore.clearAll();
                }
            });
            
            // Select asset button
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
            
            // Asset link button handler
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
        },
        
        // Get the asset store (for external access if needed)
        getAssetStore: function() {
            return assetStore;
        },
        
        // Public methods that delegate to assetStore
        addFolder: function(name) {
            return assetStore.addFolder(name);
        },
        
        addFile: function(file) {
            return assetStore.addFile(file);
        },
        
        renderTree: function() {
            return assetStore.renderTree();
        },
        
        navigateToFolder: function(folderId) {
            return assetStore.navigateToFolder(folderId);
        },
        
        deleteItem: function(itemId) {
            return assetStore.deleteItem(itemId);
        },
        
        clearAll: function() {
            return assetStore.clearAll();
        },
        
        getCurrentFolder: function() {
            return assetStore.getCurrentFolder();
        }
    };
})();

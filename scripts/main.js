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
        toolbar: [
            ['font', ['bold', 'italic', 'underline', 'clear']],
            ['para', ['ul', 'ol']],
            ['table', ['table']],
            ['insert', ['link', 'picture', 'video', 'assetManager']],
            ['view', ['fullscreen', 'codeview']]
        ],
        // Remove status bar
        disableResizeEditor: true,
        // Customize placeholder
        placeholder: 'Type something...',
        // Modern styling
        styleTags: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
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
                ['delete', ['deleteRow', 'deleteCol', 'deleteTable']]
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
        }
    });

    function uploadImage(file) {
        const reader = new FileReader();
        reader.onloadend = function() {
            const image = $('<img>').attr('src', reader.result);
            $('#summernote').summernote('insertNode', image[0]);
        }
        reader.readAsDataURL(file);
    }
    
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
});

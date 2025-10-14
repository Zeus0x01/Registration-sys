// Table Resize Functionality
class TableResizer {
    constructor() {
        this.isResizing = false;
        this.currentColumn = null;
        this.startX = 0;
        this.startWidth = 0;
        this.columnIndex = -1;
        this.animationFrame = null;
        this.init();
    }

    init() {
        // Wait for table to be available
        this.waitForTable();
    }

    waitForTable() {
        const checkTable = () => {
            const table = document.querySelector('#payments-table');
            if (table && table.querySelector('thead th')) {
                this.addResizeHandles();
                this.bindEvents();
                console.log('Table resize handles added');
            } else {
                setTimeout(checkTable, 500);
            }
        };
        checkTable();
    }

    addResizeHandles() {
        const table = document.querySelector('#payments-table');
        if (!table) return;

        const headers = table.querySelectorAll('thead th');

        headers.forEach((header, index) => {
            // Skip first column (checkbox) and last column (actions)
            if (index === 0 || index === headers.length - 1) return;

            // Remove existing handle if any
            const existingHandle = header.querySelector('.resize-handle');
            if (existingHandle) {
                existingHandle.remove();
            }

            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';

            header.style.position = 'relative';
            header.appendChild(resizeHandle);
        });
    }

    bindEvents() {
        document.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle')) {
                e.preventDefault();
                e.stopPropagation(); // Prevent event from bubbling
                this.startResize(e);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isResizing) {
                e.preventDefault();
                e.stopPropagation(); // Prevent event from bubbling
                this.scheduleResize(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isResizing) {
                e.preventDefault();
                e.stopPropagation(); // Prevent event from bubbling
                this.stopResize();
            }
        });
    }

    startResize(e) {
        this.isResizing = true;
        this.currentColumn = e.target.parentElement;
        this.startX = e.clientX;
        this.startWidth = this.currentColumn.offsetWidth;
        this.columnIndex = Array.from(this.currentColumn.parentElement.children).indexOf(this.currentColumn);

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('resizing');

        // Add a visual indicator
        this.currentColumn.style.opacity = '0.7';
    }

    scheduleResize(e) {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.animationFrame = requestAnimationFrame(() => {
            this.resize(e);
        });
    }

    resize(e) {
        if (!this.isResizing || !this.currentColumn) return;

        const deltaX = e.clientX - this.startX;
        const newWidth = Math.max(50, this.startWidth + deltaX);

        // Update the header column width with !important inline style to prevent CSS override
        this.currentColumn.style.setProperty('width', newWidth + 'px', 'important');
        this.currentColumn.style.setProperty('min-width', newWidth + 'px', 'important');
    }

    stopResize() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.isResizing = false;

        if (this.currentColumn) {
            this.currentColumn.style.opacity = '';
        }

        this.currentColumn = null;
        this.startX = 0;
        this.startWidth = 0;
        this.columnIndex = -1;

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.classList.remove('resizing');

        // Save column widths after resize is complete
        if (typeof window.saveColumnWidths === 'function') {
            window.saveColumnWidths();
        }
    }
}

// Row Resize Functionality
class RowResizer {
    constructor() {
        this.isResizing = false;
        this.currentRow = null;
        this.startY = 0;
        this.startHeight = 0;
        this.init();
    }

    init() {
        this.waitForTable();
    }

    waitForTable() {
        const checkTable = () => {
            const table = document.querySelector('#payments-table');
            if (table && table.querySelector('tbody tr')) {
                this.addRowResizeHandles();
                this.bindEvents();
                console.log('Row resize handles added');
            } else {
                setTimeout(checkTable, 500);
            }
        };
        checkTable();
    }

    addRowResizeHandles() {
        const table = document.querySelector('#payments-table');
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');

        rows.forEach((row, index) => {
            // Remove existing handle if any
            const existingHandle = row.querySelector('.row-resize-handle');
            if (existingHandle) {
                existingHandle.remove();
            }

            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'row-resize-handle';
            resizeHandle.style.cssText = `
                position: absolute;
                bottom: -2px;
                left: 0;
                right: 0;
                height: 4px;
                background: transparent;
                cursor: row-resize;
                z-index: 20;
                user-select: none;
            `;

            row.style.position = 'relative';
            row.appendChild(resizeHandle);
        });
    }

    bindEvents() {
        document.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('row-resize-handle')) {
                e.preventDefault();
                this.startResize(e);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isResizing) {
                e.preventDefault();
                this.resize(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isResizing) {
                e.preventDefault();
                this.stopResize();
            }
        });
    }

    startResize(e) {
        this.isResizing = true;
        this.currentRow = e.target.parentElement;
        this.startY = e.clientY;
        this.startHeight = this.currentRow.offsetHeight;

        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('row-resizing');
    }

    resize(e) {
        if (!this.isResizing || !this.currentRow) return;

        const deltaY = e.clientY - this.startY;
        const newHeight = Math.max(40, this.startHeight + deltaY);

        this.currentRow.style.height = newHeight + 'px';

        // Update all cells in this row
        const cells = this.currentRow.querySelectorAll('td');
        cells.forEach(cell => {
            cell.style.height = newHeight + 'px';
        });
    }

    stopResize() {
        this.isResizing = false;
        this.currentRow = null;
        this.startY = 0;
        this.startHeight = 0;

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.classList.remove('row-resizing');
    }
}

// Initialize resizers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing table resizers...');
    new TableResizer();
    new RowResizer();
});

// Re-initialize when payments are loaded
if (typeof renderPayments === 'function') {
    const originalRenderPayments = renderPayments;
    renderPayments = function(payments) {
        originalRenderPayments(payments);
        setTimeout(() => {
            console.log('Re-initializing resizers after payment render...');
            new TableResizer();
            new RowResizer();
        }, 100);
    };
}
import { LocalStorageEngine } from './services/db.local.js';
import { CloudSyncService } from './services/db.cloud.js';
import { ViewsComponent } from './components/views.js';

class App {
    constructor() {
        this.local = new LocalStorageEngine();
        this.cloud = new CloudSyncService(this.local);
        this.views = new ViewsComponent(this);
        this.items = [];
        this.activeItemId = null;
        this.activeView = localStorage.getItem('active_workspace_tab') || 'editor';
        this.currentDBRecords = [];
        this.channel = new BroadcastChannel('notion_pwa_sync_channel');
        this.init();
    }

    async init() {
        await this.local.init();
        
        await this.cloud.initSession((user) => {
            const emailDisplay = document.getElementById('user-email-display');
            const authBtn = document.getElementById('auth-toggle-btn');
            if (user) {
                emailDisplay.textContent = user.email;
                authBtn.textContent = 'Sign Out';
            } else {
                emailDisplay.textContent = '';
                authBtn.textContent = 'Sign In';
            }
        });

        // Strategic real-time event listeners for cross-device & tab sync
        this.cloud.subscribeToRealtimeChanges(async () => {
            this.items = await this.local.getAllItems();
            this.renderTree();
            if (this.activeItemId) {
                const active = this.items.find(i => i.id === this.activeItemId);
                if (active && active.type === 'page') this.renderEditor(active);
                await this.loadDBRecords(this.activeItemId);
            }
        });

        this.setupTabSync();
        this.setupTheme();
        this.setupEventListeners();
        this.setupLightbox();
        this.setupEmojiPicker();
        this.initViewTabs();
        this.setupRootDropZone();

        this.items = await this.local.getAllItems();
        if (this.items.length === 0) {
            await this.seedDemoData();
            this.items = await this.local.getAllItems();
        }

        const firstPage = this.items.find(i => i.type === 'page');
        if (firstPage) {
            this.selectItem(firstPage.id);
        }

        lucide.createIcons();
    }

    initViewTabs() {
        const savedTab = localStorage.getItem('active_workspace_tab') || 'editor';
        this.switchView(savedTab);

        document.querySelectorAll('#view-tabs button').forEach(btn => {
            btn.onclick = (e) => {
                const targetView = e.currentTarget.getAttribute('data-view');
                localStorage.setItem('active_workspace_tab', targetView);
                this.switchView(targetView);
            };
        });
    }

    switchView(view) {
        this.activeView = view;
        localStorage.setItem('active_workspace_tab', view);

        document.querySelectorAll('#view-tabs button').forEach(b => {
            b.classList.remove('border-sky-500', 'text-sky-600', 'dark:text-sky-400');
            b.classList.add('border-transparent');
        });

        const activeBtn = document.querySelector(`#view-tabs button[data-view="${view}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('border-transparent');
            activeBtn.classList.add('border-sky-500', 'text-sky-600', 'dark:text-sky-400');
        }

        document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
        const panel = document.getElementById(`view-${view}`);
        if (panel) panel.classList.remove('hidden');

        if (view === 'table') this.views.renderTableView();
        if (view === 'kanban') this.views.renderKanbanView();
        if (view === 'gallery') this.views.renderGalleryView();
    }

    setupTabSync() {
        this.channel.onmessage = async () => {
            const spinner = document.getElementById('sync-spinner-badge');
            if (spinner) spinner.classList.remove('hidden');
            this.items = await this.local.getAllItems();
            this.renderTree();
            if (this.activeItemId) {
                const active = this.items.find(i => i.id === this.activeItemId);
                if (active && active.type === 'page') this.renderEditor(active);
                await this.loadDBRecords(this.activeItemId);
            }
            if (spinner) setTimeout(() => spinner.classList.add('hidden'), 500);
        };
    }

    setupTheme() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;
        toggle.onclick = () => {
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        };
        if (localStorage.getItem('theme') === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        }
    }

    setupLightbox() {
        const modal = document.getElementById('image-lightbox-modal');
        const lightboxImg = document.getElementById('lightbox-img');
        const closeBtn = document.getElementById('close-lightbox');
        if (!modal || !lightboxImg) return;

        const closeModal = (e) => {
            if (e) e.preventDefault();
            modal.classList.add('hidden');
        };

        if (closeBtn) {
            closeBtn.onclick = closeModal;
            closeBtn.ontouchend = closeModal;
        }

        modal.onclick = (e) => {
            if (e.target === modal) closeModal(e);
        };
        modal.ontouchend = (e) => {
            if (e.target === modal) closeModal(e);
        };
    }

    openLightbox(src) {
        const modal = document.getElementById('image-lightbox-modal');
        const lightboxImg = document.getElementById('lightbox-img');
        if (modal && lightboxImg) {
            lightboxImg.src = src;
            modal.classList.remove('hidden');
        }
    }

    setupEmojiPicker() {
        const modal = document.getElementById('emoji-picker-modal');
        const box = document.getElementById('emoji-modal-box');
        const closeBtn = document.getElementById('close-emoji-modal');
        if (!modal || !box) return;

        const closeModal = (e) => {
            if (e) e.preventDefault();
            box.classList.remove('scale-100', 'opacity-100');
            box.classList.add('scale-95', 'opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 150);
        };

        if (closeBtn) {
            closeBtn.onclick = closeModal;
            closeBtn.ontouchend = closeModal;
        }

        modal.onclick = (e) => { if (e.target === modal) closeModal(e); };
        modal.ontouchend = (e) => { if (e.target === modal) closeModal(e); };

        document.querySelectorAll('.emoji-option').forEach(btn => {
            const selectEmoji = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const emoji = btn.textContent;
                closeModal();

                if (!this.activeItemId) return;
                const item = this.items.find(i => i.id === this.activeItemId);
                if (item) {
                    item.icon = emoji;
                    const emojiEl = document.getElementById('page-emoji');
                    if (emojiEl) emojiEl.textContent = emoji;
                    await this.cloud.syncItemUp(item);
                    this.channel.postMessage('sync');
                    this.renderTree();
                }
            };
            btn.onclick = selectEmoji;
            btn.ontouchend = selectEmoji;
            btn.addEventListener('pointerdown', selectEmoji);
        });
    }

    setupEventListeners() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebarOpenBtn = document.getElementById('sidebar-open-btn');

        if (sidebarToggle && sidebar && sidebarOpenBtn) {
            sidebarToggle.onclick = () => {
                sidebar.classList.add('-ml-64');
                sidebarOpenBtn.classList.remove('hidden');
            };
            sidebarOpenBtn.onclick = () => {
                sidebar.classList.remove('-ml-64');
                sidebarOpenBtn.classList.add('hidden');
            };
        }

        const authToggle = document.getElementById('auth-toggle-btn');
        if (authToggle) {
            authToggle.onclick = async () => {
                if (this.cloud.user) {
                    await this.cloud.signOut();
                    window.location.reload();
                } else {
                    document.getElementById('auth-modal').classList.remove('hidden');
                }
            };
        }

        const authCancel = document.getElementById('auth-cancel');
        if (authCancel) {
            authCancel.onclick = () => {
                document.getElementById('auth-modal').classList.add('hidden');
            };
        }

        const authSubmit = document.getElementById('auth-submit');
        if (authSubmit) {
            authSubmit.onclick = async () => {
                const email = document.getElementById('auth-email').value;
                const password = document.getElementById('auth-password').value;
                try {
                    await this.cloud.signIn(email, password);
                    window.location.reload();
                } catch (err) {
                    alert(err.message);
                }
            };
        }

        document.getElementById('btn-quick-new-page').onclick = () => this.createNewItem('page');
        document.getElementById('btn-quick-new-folder').onclick = () => this.createNewItem('folder');

        document.getElementById('btn-export-workspace').onclick = () => this.exportWorkspaceJSON();

        document.getElementById('btn-import-file').onclick = () => {
            document.getElementById('universal-file-input').click();
        };

        document.getElementById('universal-file-input').onchange = (e) => this.handleUniversalImport(e);

        const exportCsvBtn = document.getElementById('btn-export-csv');
        if (exportCsvBtn) exportCsvBtn.onclick = () => this.exportTableCSV();

        const importCsvBtn = document.getElementById('btn-import-csv');
        const csvFileInput = document.getElementById('csv-file-input');
        if (importCsvBtn && csvFileInput) {
            importCsvBtn.onclick = () => csvFileInput.click();
            csvFileInput.onchange = (e) => this.handleCSVImport(e);
        }

        document.getElementById('page-title-input').oninput = async (e) => {
            if (!this.activeItemId) return;
            const item = this.items.find(i => i.id === this.activeItemId);
            if (item) {
                item.title = e.target.value || 'Untitled';
                await this.cloud.syncItemUp(item);
                this.channel.postMessage('sync');
                this.renderTree();
                document.getElementById('current-title-breadcrumb').textContent = item.title;
            }
        };

        const pageEmojiBtn = document.getElementById('page-emoji');
        if (pageEmojiBtn) {
            const openEmojiModal = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const modal = document.getElementById('emoji-picker-modal');
                const box = document.getElementById('emoji-modal-box');
                if (modal && box) {
                    modal.classList.remove('hidden');
                    setTimeout(() => {
                        box.classList.remove('scale-95', 'opacity-0');
                        box.classList.add('scale-100', 'opacity-100');
                    }, 10);
                }
            };
            pageEmojiBtn.onclick = openEmojiModal;
            pageEmojiBtn.ontouchend = openEmojiModal;
        }

        document.getElementById('delete-current-page').onclick = async () => {
            if (!this.activeItemId) return;
            const confirmed = await this.showModal({
                title: 'Delete Item',
                description: 'Are you sure you want to delete this item? This cannot be undone.'
            });
            if (confirmed) {
                await this.cloud.deleteItemUp(this.activeItemId);
                this.channel.postMessage('sync');
                this.activeItemId = null;
                this.items = await this.local.getAllItems();
                const next = this.items.find(i => i.type === 'page');
                if (next) this.selectItem(next.id);
                else window.location.reload();
            }
        };

        document.querySelectorAll('.add-block-btn').forEach(btn => {
            btn.onclick = () => this.addBlock(btn.getAttribute('data-type'));
        });

        document.getElementById('add-db-row-btn').onclick = () => this.addDBRecord();
        document.getElementById('add-kanban-card-btn').onclick = () => this.addDBRecord();

        document.getElementById('sidebar-search').oninput = (e) => {
            this.renderTree(e.target.value.toLowerCase());
        };
    }

    exportWorkspaceJSON() {
        const jsonString = JSON.stringify(this.items, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `workspace_backup_${timestamp}.json`;

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    async handleUniversalImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.name.endsWith('.json')) {
            await this.importWorkspaceJSON(file);
        } else if (file.name.endsWith('.zip')) {
            await this.importNotionZip(file);
        } else if (file.name.endsWith('.csv')) {
            await this.handleCSVImport(event);
        } else {
            alert('Unsupported file type. Please upload a .json, .zip, or .csv file.');
        }
        event.target.value = '';
    }

    async importWorkspaceJSON(file) {
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                for (const item of data) {
                    await this.cloud.syncItemUp(item);
                }
                this.items = await this.local.getAllItems();
                this.renderTree();
                if (this.items.length > 0) {
                    this.selectItem(this.items[0].id);
                }
                alert('Workspace JSON backup successfully imported!');
            } else {
                alert('Invalid JSON file format: Expected an array of workspace items.');
            }
        } catch (err) {
            console.error('Error importing JSON:', err);
            alert('Failed to parse workspace JSON file.');
        }
    }

    async importNotionZip(file) {
        try {
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(file);
            const folderMap = new Map();

            const entries = [];
            zip.forEach((relativePath, zipEntry) => {
                entries.push({ path: relativePath, entry: zipEntry });
            });

            for (const item of entries) {
                const parts = item.path.split('/').filter(p => p.length > 0);
                let parentId = null;

                for (let i = 0; i < parts.length - 1; i++) {
                    const folderPath = parts.slice(0, i + 1).join('/');
                    if (!folderMap.has(folderPath)) {
                        const folderObj = {
                            id: 'folder_' + Math.random().toString(36).substr(2, 9),
                            parentId: parentId,
                            type: 'folder',
                            title: parts[i],
                            icon: '📁',
                            expanded: true,
                            updatedAt: new Date().toISOString()
                        };
                        await this.cloud.syncItemUp(folderObj);
                        folderMap.set(folderPath, folderObj.id);
                    }
                    parentId = folderMap.get(folderPath);
                }

                if (!item.entry.dir && item.path.endsWith('.md')) {
                    const content = await item.entry.async('string');
                    const fileName = parts[parts.length - 1];
                    const cleanTitle = fileName.replace(/\.md$/, '').replace(/\s+[a-f0-9]{32}$/, '');
                    
                    const rawLines = content.split('\n');
                    const blocks = [];
                    let inAside = false;
                    let asideBuffer = [];

                    for (let rawLine of rawLines) {
                        let line = rawLine.trim();
                        if (!line) continue;

                        if (line.startsWith('<aside>')) {
                            inAside = true;
                            continue;
                        }
                        if (line.endsWith('</aside>')) {
                            inAside = false;
                            const textContent = asideBuffer
                                .filter(l => !l.startsWith('<img') && !l.startsWith('</aside>'))
                                .join(' ')
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .trim();
                            if (textContent) {
                                blocks.push({
                                    id: 'b_' + Math.random().toString(36).substr(2, 9),
                                    type: 'callout',
                                    content: textContent
                                });
                            }
                            asideBuffer = [];
                            continue;
                        }

                        if (inAside) {
                            asideBuffer.push(line);
                            continue;
                        }

                        // Properly define formattedText with HTML bold tags
                        let formattedText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

                        if (line.startsWith('# ')) {
                            blocks.push({
                                id: 'b_' + Math.random().toString(36).substr(2, 9),
                                type: 'h1',
                                content: line.replace(/^#\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')
                            });
                        } else if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
                            blocks.push({
                                id: 'b_' + Math.random().toString(36).substr(2, 9),
                                type: 'todo',
                                content: formattedText.replace(/^- \[[ x]\]\s*/, ''),
                                checked: line.startsWith('- [x]')
                            });
                        } else if (line.startsWith('- ') || line.startsWith('* ')) {
                            blocks.push({
                                id: 'b_' + Math.random().toString(36).substr(2, 9),
                                type: 'paragraph',
                                content: '• ' + formattedText.replace(/^[-*]\s+/, '')
                            });
                        } else {
                            blocks.push({
                                id: 'b_' + Math.random().toString(36).substr(2, 9),
                                type: 'paragraph',
                                content: formattedText
                            });
                        }
                    }

                    if (blocks.length === 0) {
                        blocks.push({ id: 'b_1', type: 'paragraph', content: '' });
                    }

                    const pageObj = {
                        id: 'page_' + Math.random().toString(36).substr(2, 9),
                        parentId: parentId,
                        type: 'page',
                        title: cleanTitle || 'Untitled Notion Page',
                        icon: '📄',
                        blocks: blocks,
                        updatedAt: new Date().toISOString()
                    };
                    await this.cloud.syncItemUp(pageObj);
                    if (!this.activeItemId) this.activeItemId = pageObj.id;
                }
            }

            this.items = await this.local.getAllItems();
            this.renderTree();
            if (this.activeItemId) this.selectItem(this.activeItemId);
            alert('Notion ZIP archive imported successfully!');
        } catch (err) {
            console.error('Error importing Notion ZIP:', err);
            alert('Failed to import Notion ZIP archive.');
        }
    }

    exportTableCSV() {
        if (!this.currentDBRecords || this.currentDBRecords.length === 0) {
            alert('No records to export in the current database view.');
            return;
        }

        const headers = ['Title', 'Status', 'Tag', 'Priority'];
        const csvRows = [headers.join(',')];

        this.currentDBRecords.forEach(rec => {
            const row = [
                `"${(rec.title || '').replace(/"/g, '""')}"`,
                `"${(rec.status || '').replace(/"/g, '""')}"`,
                `"${(rec.tag || '').replace(/"/g, '""')}"`,
                `"${(rec.priority || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spreadsheet_export.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    async handleCSVImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length <= 1) {
            alert('CSV file is empty or missing data rows.');
            return;
        }

        const parseCSVLine = (line) => {
            const res = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        cur += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    res.push(cur.trim());
                    cur = '';
                } else {
                    cur += char;
                }
            }
            res.push(cur.trim());
            return res;
        };

        const headers = parseCSVLine(lines[0]);
        for (let i = 1; i < lines.length; i++) {
            const vals = parseCSVLine(lines[i]);
            const title = vals[0] || 'Imported Item';
            const status = vals[1] || 'To Do';
            const tag = vals[2] || 'General';
            const priority = vals[3] || 'Medium';

            const newRec = {
                id: 'rec_' + Math.random().toString(36).substr(2, 9),
                pageId: this.activeItemId,
                title,
                status,
                tag,
                priority
            };
            await this.cloud.syncRecordUp(newRec);
        }

        await this.loadDBRecords(this.activeItemId);
        this.channel.postMessage('sync');
        alert('CSV spreadsheet successfully imported into database view!');
        event.target.value = '';
    }

    async seedDemoData() {
        const folder = {
            id: 'folder_1', parentId: null, type: 'folder', title: 'Projects', icon: '📁', expanded: true, updatedAt: new Date().toISOString()
        };
        const page = {
            id: 'page_demo', parentId: 'folder_1', type: 'page', title: 'Welcome Workspace', icon: '🚀',
            blocks: [
                { id: 'b1', type: 'h1', content: 'Modular Cloud-Synced Notion PWA' },
                { id: 'b2', type: 'callout', content: 'Your sidebar collapses and pages nest inside folders!' },
                { id: 'b3', type: 'todo', content: 'Try editing blocks or switching views above', checked: false }
            ],
            updatedAt: new Date().toISOString()
        };
        await this.cloud.syncItemUp(folder);
        await this.cloud.syncItemUp(page);
        await this.cloud.syncRecordUp({ id: 'rec_1', pageId: 'page_demo', title: 'Setup Modules', status: 'Done', tag: 'Engineering', priority: 'High' });
    }

    setupRootDropZone() {
        const treeRoot = document.getElementById('tree-root');
        if (!treeRoot) return;
        treeRoot.addEventListener('dragover', (e) => e.preventDefault());
        treeRoot.addEventListener('drop', async (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId) {
                const page = this.items.find(i => i.id === draggedId);
                if (page && page.parentId !== null) {
                    page.parentId = null;
                    await this.cloud.syncItemUp(page);
                    this.channel.postMessage('sync');
                    this.renderTree();
                }
            }
        });
    }

    renderTree(query = '') {
        const root = document.getElementById('tree-root');
        if (!root) return;
        root.innerHTML = '';
        const itemCount = document.getElementById('item-count');
        if (itemCount) itemCount.textContent = `${this.items.length} items`;

        const rootItems = this.items.filter(i => i.parentId === null);
        const buildNode = (item, depth = 0) => {
            if (query && !item.title.toLowerCase().includes(query)) return null;

            const wrapper = document.createElement('div');
            wrapper.className = 'space-y-0.5';

            const row = document.createElement('div');
            const isActive = item.id === this.activeItemId;
            row.className = `group flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition select-none ${isActive ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 font-semibold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'}`;
            row.style.paddingLeft = `${(depth * 12) + 8}px`;

            row.setAttribute('draggable', 'true');
            row.setAttribute('data-id', item.id);

            row.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', item.id);
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.type === 'folder') {
                    row.classList.add('bg-sky-100/60', 'dark:bg-sky-950/40');
                }
            });

            row.addEventListener('dragleave', () => {
                row.classList.remove('bg-sky-100/60', 'dark:bg-sky-950/40');
            });

            row.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                row.classList.remove('bg-sky-100/60', 'dark:bg-sky-950/40');
                const draggedId = e.dataTransfer.getData('text/plain');

                if (draggedId && draggedId !== item.id && item.type === 'folder') {
                    const page = this.items.find(i => i.id === draggedId);
                    if (page) {
                        page.parentId = item.id;
                        await this.cloud.syncItemUp(page);
                        this.channel.postMessage('sync');
                        this.renderTree();
                    }
                }
            });

            const left = document.createElement('div');
            left.className = 'flex items-center space-x-1.5 truncate flex-1';

            if (item.type === 'folder') {
                const toggle = document.createElement('button');
                toggle.className = 'p-0.5 hover:bg-slate-300 dark:hover:bg-zinc-700 rounded text-slate-400';
                toggle.innerHTML = `<i data-lucide="chevron-${item.expanded ? 'down' : 'right'}" class="w-3.5 h-3.5"></i>`;
                toggle.onclick = async (e) => {
                    e.stopPropagation();
                    item.expanded = !item.expanded;
                    await this.cloud.syncItemUp(item);
                    this.renderTree(query);
                };
                left.appendChild(toggle);
            }

            const iconSpan = document.createElement('span');
            iconSpan.textContent = item.icon || (item.type === 'folder' ? '📁' : '📄');
            left.appendChild(iconSpan);

            const titleSpan = document.createElement('span');
            titleSpan.className = 'truncate';
            titleSpan.textContent = item.title;
            left.appendChild(titleSpan);

            row.appendChild(left);

            const actions = document.createElement('div');
            actions.className = 'hidden group-hover:flex items-center space-x-1';
            if (item.type === 'folder') {
                const addSub = document.createElement('button');
                addSub.className = 'p-0.5 hover:bg-slate-300 dark:hover:bg-zinc-700 rounded text-slate-500';
                addSub.title = 'Add Page Inside';
                addSub.innerHTML = `<i data-lucide="plus" class="w-3 h-3"></i>`;
                addSub.onclick = (e) => {
                    e.stopPropagation();
                    this.createNewItem('page', item.id);
                };
                actions.appendChild(addSub);
            }
            row.appendChild(actions);

            row.onclick = () => this.selectItem(item.id);
            wrapper.appendChild(row);

            if (item.type === 'folder' && item.expanded) {
                const children = this.items.filter(i => i.parentId === item.id);
                const childContainer = document.createElement('div');
                children.forEach(child => {
                    const childNode = buildNode(child, depth + 1);
                    if (childNode) childContainer.appendChild(childNode);
                });
                wrapper.appendChild(childContainer);
            }

            return wrapper;
        };

        rootItems.forEach(item => {
            const node = buildNode(item);
            if (node) root.appendChild(node);
        });
        lucide.createIcons();
    }

    async createNewItem(type = 'page', parentId = null) {
        const newItem = {
            id: 'item_' + Date.now(), parentId, type, title: type === 'folder' ? 'New Folder' : 'Untitled Page',
            icon: type === 'folder' ? '📁' : '📄', expanded: true,
            blocks: type === 'page' ? [{ id: 'b_' + Date.now(), type: 'paragraph', content: '' }] : [],
            updatedAt: new Date().toISOString()
        };
        await this.cloud.syncItemUp(newItem);
        this.channel.postMessage('sync');
        this.items = await this.local.getAllItems();
        if (type === 'page') this.selectItem(newItem.id);
        else this.renderTree();
    }

    async selectItem(id) {
        this.activeItemId = id;
        const item = this.items.find(i => i.id === id);
        if (!item) return;

        this.renderTree();
        document.getElementById('current-title-breadcrumb').textContent = item.title;
        document.getElementById('page-title-input').value = item.title;
        document.getElementById('page-emoji').textContent = item.icon || '📝';

        if (item.type === 'page') {
            this.renderEditor(item);
            await this.loadDBRecords(item.id);
            this.switchView(this.activeView);
        } else {
            document.getElementById('blocks-container').innerHTML = `<div class="text-sm text-slate-400 py-8 text-center">Folder view. Select a page inside.</div>`;
        }
        lucide.createIcons();
    }

    renderEditor(page) {
        const container = document.getElementById('blocks-container');
        if (!container) return;
        container.innerHTML = '';
        (page.blocks || []).forEach(block => {
            const blockEl = this.createBlockElement(block, page);
            container.appendChild(blockEl);
        });
        lucide.createIcons();
    }

    createBlockElement(block, page) {
        const container = document.createElement('div');
        container.className = 'group flex items-start gap-2 relative py-0.5';

        const delBtn = document.createElement('button');
        delBtn.className = 'opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded';
        delBtn.innerHTML = `<i data-lucide="trash" class="w-3.5 h-3.5"></i>`;
        delBtn.onclick = async () => {
            page.blocks = page.blocks.filter(b => b.id !== block.id);
            await this.cloud.syncItemUp(page);
            this.channel.postMessage('sync');
            this.renderEditor(page);
        };
        container.appendChild(delBtn);

        let contentEl;
        if (block.type === 'h1') {
            contentEl = document.createElement('h1');
            contentEl.className = 'w-full text-2xl font-bold outline-none text-slate-900 dark:text-slate-100 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-zinc-600';
            contentEl.contentEditable = true;
            contentEl.setAttribute('data-placeholder', 'Heading 1...');
            contentEl.textContent = block.content;
            contentEl.oninput = async () => {
                block.content = contentEl.textContent;
                await this.cloud.syncItemUp(page);
                this.channel.postMessage('sync');
            };
        } else if (block.type === 'todo') {
            contentEl = document.createElement('div');
            contentEl.className = 'flex items-center gap-2 w-full';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = block.checked || false;
            cb.className = 'w-4 h-4 rounded text-sky-600 cursor-pointer';
            cb.onchange = async () => {
                block.checked = cb.checked;
                await this.cloud.syncItemUp(page);
                this.channel.postMessage('sync');
            };
            const text = document.createElement('div');
            text.className = `w-full outline-none text-sm empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-zinc-600 ${block.checked ? 'line-through text-slate-400' : ''}`;
            text.contentEditable = true;
            text.setAttribute('data-placeholder', 'To-do item...');
            text.innerHTML = block.content;
            text.oninput = async () => {
                block.content = text.innerHTML;
                await this.cloud.syncItemUp(page);
                this.channel.postMessage('sync');
            };
            contentEl.appendChild(cb);
            contentEl.appendChild(text);
        } else if (block.type === 'code') {
            contentEl = document.createElement('textarea');
            contentEl.className = 'w-full bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded outline-none';
            contentEl.placeholder = 'Type code snippet...';
            contentEl.value = block.content;
            contentEl.oninput = async () => {
                block.content = contentEl.value;
                await this.cloud.syncItemUp(page);
                this.channel.postMessage('sync');
            };
        } else if (block.type === 'callout') {
            contentEl = document.createElement('div');
            contentEl.className = 'w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded p-3 text-sm outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-amber-400';
            contentEl.contentEditable = true;
            contentEl.setAttribute('data-placeholder', 'Type callout text...');
            contentEl.innerHTML = block.content;
            contentEl.oninput = async () => {
                block.content = contentEl.innerHTML;
                await this.cloud.syncItemUp(page);
                this.channel.postMessage('sync');
            };
        } else if (block.type === 'image') {
            contentEl = document.createElement('div');
            contentEl.className = 'w-full space-y-2';
            if (block.content) {
                const img = document.createElement('img');
                img.src = block.content;
                img.className = 'max-h-80 rounded-lg shadow-md cursor-pointer hover:opacity-95 transition object-cover';
                
                const triggerOpen = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openLightbox(block.content);
                };
                img.addEventListener('pointerdown', triggerOpen);

                const replaceBtn = document.createElement('button');
                replaceBtn.className = 'text-xs text-sky-600 dark:text-sky-400 hover:underline block';
                replaceBtn.textContent = 'Change Image';
                replaceBtn.onclick = () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                                block.content = ev.target.result;
                                await this.cloud.syncItemUp(page);
                                this.channel.postMessage('sync');
                                this.renderEditor(page);
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                };
                contentEl.appendChild(img);
                contentEl.appendChild(replaceBtn);
            } else {
                const uploadBtn = document.createElement('button');
                uploadBtn.className = 'px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 rounded text-xs text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5';
                uploadBtn.innerHTML = `<i data-lucide="image" class="w-4 h-4"></i> Upload Image`;
                uploadBtn.onclick = () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                                block.content = ev.target.result;
                                await this.cloud.syncItemUp(page);
                                this.channel.postMessage('sync');
                                this.renderEditor(page);
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                };
                contentEl.appendChild(uploadBtn);
            }
        } else if (block.type === 'file') {
            contentEl = document.createElement('div');
            contentEl.className = 'w-full';
            if (block.content && block.fileName) {
                const card = document.createElement('div');
                card.className = 'flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs';
                card.innerHTML = `
                    <div class="flex items-center gap-2 truncate">
                        <i data-lucide="file-text" class="w-4 h-4 text-blue-500"></i>
                        <span class="font-medium text-slate-700 dark:text-slate-200 truncate">${block.fileName}</span>
                    </div>
                    <a href="${block.content}" download="${block.fileName}" class="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded transition">Download</a>
                `;
                contentEl.appendChild(card);
            } else {
                const uploadBtn = document.createElement('button');
                uploadBtn.className = 'px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 rounded text-xs text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5';
                uploadBtn.innerHTML = `<i data-lucide="file-text" class="w-4 h-4"></i> Attach File`;
                uploadBtn.onclick = () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                                block.content = ev.target.result;
                                block.fileName = file.name;
                                await this.cloud.syncItemUp(page);
                                this.channel.postMessage('sync');
                                this.renderEditor(page);
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                };
                contentEl.appendChild(uploadBtn);
            }
        } else {
            contentEl = document.createElement('div');
            contentEl.className = 'w-full text-sm outline-none text-slate-700 dark:text-slate-300 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-zinc-600';
            contentEl.contentEditable = true;
            contentEl.setAttribute('data-placeholder', 'Type text...');
            contentEl.innerHTML = block.content;
            contentEl.oninput = async () => {
                block.content = contentEl.innerHTML;
                await this.cloud.syncItemUp(page);
                this.channel.postMessage('sync');
            };
        }

        container.appendChild(contentEl);
        return container;
    }  

    async addBlock(type) {
        if (!this.activeItemId) return;
        const page = this.items.find(i => i.id === this.activeItemId);
        if (!page) return;
        page.blocks = page.blocks || [];
        page.blocks.push({ id: 'b_' + Date.now(), type, content: '', checked: false, fileName: '' });
        await this.cloud.syncItemUp(page);
        this.channel.postMessage('sync');
        this.renderEditor(page);
    }

    async loadDBRecords(pageId) {
        this.currentDBRecords = await this.local.getDBRecords(pageId);
        if (this.activeView === 'table') this.views.renderTableView();
        if (this.activeView === 'kanban') this.views.renderKanbanView();
        if (this.activeView === 'gallery') this.views.renderGalleryView();
    }

    async addDBRecord() {
        if (!this.activeItemId) return;
        const rec = { id: 'rec_' + Date.now(), pageId: this.activeItemId, title: 'New Item', status: 'To Do', tag: 'General', priority: 'Medium' };
        await this.cloud.syncRecordUp(rec);
        this.channel.postMessage('sync');
        await this.loadDBRecords(this.activeItemId);
    }

    showModal({ title, description, isPrompt = false, defaultValue = '' }) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-modal');
            const box = document.getElementById('modal-box');
            const titleEl = document.getElementById('modal-title');
            const descEl = document.getElementById('modal-desc');
            const inputContainer = document.getElementById('modal-input-container');
            const inputEl = document.getElementById('modal-input');
            const cancelBtn = document.getElementById('modal-cancel');
            const confirmBtn = document.getElementById('modal-confirm');

            titleEl.textContent = title;
            descEl.textContent = description;
            inputEl.value = defaultValue;

            if (isPrompt) {
                inputContainer.classList.remove('hidden');
            } else {
                inputContainer.classList.add('hidden');
            }

            modal.classList.remove('hidden');
            setTimeout(() => {
                box.classList.remove('scale-95', 'opacity-0');
                box.classList.add('scale-100', 'opacity-100');
                if (isPrompt) inputEl.focus();
            }, 10);

            const cleanup = (result) => {
                box.classList.remove('scale-100', 'opacity-100');
                box.classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    modal.classList.add('hidden');
                    cancelBtn.onclick = null;
                    confirmBtn.onclick = null;
                    resolve(result);
                }, 150);
            };

            cancelBtn.onclick = () => cleanup(isPrompt ? null : false);
            confirmBtn.onclick = () => cleanup(isPrompt ? inputEl.value : true);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new App(); });

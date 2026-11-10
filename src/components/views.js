export class ViewsComponent {
    constructor(appInstance) {
        this.app = appInstance;
        this.loadLocalTags();
        this.statusList = ['To Do', 'In Progress', 'Done'];
        this.prioritiesList = ['Low', 'Medium', 'High', 'Urgent'];
    }

    loadLocalTags() {
        this.tagsList = JSON.parse(localStorage.getItem('notion_custom_tags')) || ['Engineering', 'Design', 'Product', 'Marketing', 'Database', 'DevOps', 'General'];
        this.tagColors = JSON.parse(localStorage.getItem('notion_tag_colors')) || {
            'Engineering': 'text-sky-600 dark:text-sky-400 font-semibold',
            'Design': 'text-purple-600 dark:text-purple-400 font-semibold',
            'Product': 'text-emerald-600 dark:text-emerald-400 font-semibold',
            'Marketing': 'text-pink-600 dark:text-pink-400 font-semibold',
            'Database': 'text-amber-600 dark:text-amber-400 font-semibold',
            'DevOps': 'text-indigo-600 dark:text-indigo-400 font-semibold',
            'General': 'text-slate-600 dark:text-slate-400 font-semibold'
        };
        this.tagBadgeBg = JSON.parse(localStorage.getItem('notion_tag_badge_bg')) || {
            'Engineering': 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
            'Design': 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300',
            'Product': 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
            'Marketing': 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300',
            'Database': 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
            'DevOps': 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300',
            'General': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
        };
    }

    saveCustomTags() {
        localStorage.setItem('notion_custom_tags', JSON.stringify(this.tagsList));
        localStorage.setItem('notion_tag_colors', JSON.stringify(this.tagColors));
        localStorage.setItem('notion_tag_badge_bg', JSON.stringify(this.tagBadgeBg));
        if (this.app.cloud) {
            this.app.cloud.syncCustomTagsUp(this.tagsList, this.tagColors, this.tagBadgeBg);
        }
    }

    getTagColor(tag) {
        this.loadLocalTags();
        return this.tagColors[tag] || 'text-slate-600 dark:text-slate-400 font-semibold';
    }

    getTagBadgeBg(tag) {
        this.loadLocalTags();
        return this.tagBadgeBg[tag] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    }

    getStatusBadgeBg(status) {
        const bgMap = {
            'To Do': 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300',
            'In Progress': 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
            'Done': 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
        };
        return bgMap[status] || 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300';
    }

    getPriorityColor(priority) {
        const colors = {
            'Low': 'text-slate-500 dark:text-slate-400',
            'Medium': 'text-blue-600 dark:text-blue-400',
            'High': 'text-orange-600 dark:text-orange-400',
            'Urgent': 'text-red-600 dark:text-red-400'
        };
        return colors[priority] || 'text-slate-600 dark:text-slate-400';
    }

    getPriorityBadgeBg(priority) {
        const bgMap = {
            'Low': 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400',
            'Medium': 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
            'High': 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300',
            'Urgent': 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
        };
        return bgMap[priority] || 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300';
    }

    // Displays a clean floating pop-up overlay for Status selection
    async showStatusPickerPopup(currentStatus) {
        return new Promise((resolve) => {
            let overlay = document.getElementById('status-picker-popup-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'status-picker-popup-overlay';
                overlay.className = 'fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4';
                document.body.appendChild(overlay);
            }

            overlay.innerHTML = `
                <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl w-64 p-3 space-y-2 select-none animate-in fade-in zoom-in-95 duration-150">
                    <div class="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span>Select Status</span>
                        <button id="close-status-popup" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                    </div>
                    <div id="status-popup-list" class="space-y-1"></div>
                </div>
            `;

            overlay.classList.remove('hidden');

            const listContainer = overlay.querySelector('#status-popup-list');
            const closeBtn = overlay.querySelector('#close-status-popup');

            this.statusList.forEach(s => {
                const row = document.createElement('div');
                row.className = `flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/80 cursor-pointer transition ${currentStatus === s ? 'bg-slate-100/80 dark:bg-zinc-800/50' : ''}`;
                
                const badge = document.createElement('span');
                badge.className = `px-2.5 py-0.5 rounded-md text-[11px] font-medium ${this.getStatusBadgeBg(s)}`;
                badge.textContent = s;

                row.appendChild(badge);

                if (currentStatus === s) {
                    const check = document.createElement('i');
                    check.className = 'w-3.5 h-3.5 text-sky-600 dark:text-sky-400';
                    check.setAttribute('data-lucide', 'check');
                    row.appendChild(check);
                }

                row.onclick = () => {
                    overlay.classList.add('hidden');
                    resolve(s);
                };

                listContainer.appendChild(row);
            });
            lucide.createIcons();

            closeBtn.onclick = () => {
                overlay.classList.add('hidden');
                resolve(null);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                    resolve(null);
                }
            };
        });
    }

    // Displays a clean floating pop-up overlay for Priority selection
    async showPriorityPickerPopup(currentPriority) {
        return new Promise((resolve) => {
            let overlay = document.getElementById('priority-picker-popup-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'priority-picker-popup-overlay';
                overlay.className = 'fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4';
                document.body.appendChild(overlay);
            }

            overlay.innerHTML = `
                <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl w-64 p-3 space-y-2 select-none animate-in fade-in zoom-in-95 duration-150">
                    <div class="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span>Select Priority</span>
                        <button id="close-priority-popup" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                    </div>
                    <div id="priority-popup-list" class="space-y-1"></div>
                </div>
            `;

            overlay.classList.remove('hidden');

            const listContainer = overlay.querySelector('#priority-popup-list');
            const closeBtn = overlay.querySelector('#close-priority-popup');

            this.prioritiesList.forEach(p => {
                const row = document.createElement('div');
                row.className = `flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/80 cursor-pointer transition ${currentPriority === p ? 'bg-slate-100/80 dark:bg-zinc-800/50' : ''}`;
                
                const badge = document.createElement('span');
                badge.className = `px-2.5 py-0.5 rounded-md text-[11px] font-medium ${this.getPriorityBadgeBg(p)}`;
                badge.textContent = p;

                row.appendChild(badge);

                if (currentPriority === p) {
                    const check = document.createElement('i');
                    check.className = 'w-3.5 h-3.5 text-sky-600 dark:text-sky-400';
                    check.setAttribute('data-lucide', 'check');
                    row.appendChild(check);
                }

                row.onclick = () => {
                    overlay.classList.add('hidden');
                    resolve(p);
                };

                listContainer.appendChild(row);
            });
            lucide.createIcons();

            closeBtn.onclick = () => {
                overlay.classList.add('hidden');
                resolve(null);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                    resolve(null);
                }
            };
        });
    }

    // Displays a clean, unclipped floating pop-up overlay for tag selection & management
    async showTagPickerPopup(currentTag) {
        this.loadLocalTags();
        return new Promise((resolve) => {
            let overlay = document.getElementById('tag-picker-popup-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'tag-picker-popup-overlay';
                overlay.className = 'fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4';
                document.body.appendChild(overlay);
            }

            overlay.innerHTML = `
                <div id="tag-picker-card" class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl w-72 p-3 space-y-2 select-none animate-in fade-in zoom-in-95 duration-150">
                    <div class="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span>Select or Manage Tag</span>
                        <button id="close-tag-popup" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                    </div>
                    <div id="tag-popup-list" class="max-h-56 overflow-y-auto space-y-1"></div>
                    <div class="pt-2 border-t border-slate-100 dark:border-zinc-800">
                        <button id="add-new-tag-popup-btn" class="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
                            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add Custom Tag...
                        </button>
                    </div>
                </div>
            `;

            overlay.classList.remove('hidden');

            const listContainer = overlay.querySelector('#tag-popup-list');
            const closeBtn = overlay.querySelector('#close-tag-popup');
            const addNewBtn = overlay.querySelector('#add-new-tag-popup-btn');

            const renderList = () => {
                listContainer.innerHTML = '';
                this.tagsList.forEach(t => {
                    const row = document.createElement('div');
                    row.className = `group flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/80 cursor-pointer transition ${currentTag === t ? 'bg-slate-100/80 dark:bg-zinc-800/50' : ''}`;
                    
                    const badge = document.createElement('span');
                    badge.className = `px-2.5 py-0.5 rounded-md text-[11px] font-medium ${this.getTagBadgeBg(t)}`;
                    badge.textContent = t;

                    row.appendChild(badge);

                    // Mini trash button directly next to each tag
                    const delBtn = document.createElement('button');
                    delBtn.type = 'button';
                    delBtn.className = 'p-1 text-slate-400 hover:text-red-500 rounded transition opacity-60 hover:opacity-100';
                    delBtn.title = `Delete "${t}" tag`;
                    delBtn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>`;

                    delBtn.onclick = async (e) => {
                        e.stopPropagation();
                        // Hide tag picker overlay temporary so modal pops up cleanly on top
                        overlay.classList.add('hidden');
                        const confirmDel = await this.app.showModal({
                            title: 'Delete Tag',
                            description: `Are you sure you want to delete the tag "${t}"?`
                        });
                        if (confirmDel) {
                            this.tagsList = this.tagsList.filter(item => item !== t);
                            delete this.tagColors[t];
                            delete this.tagBadgeBg[t];
                            this.saveCustomTags();
                            overlay.classList.remove('hidden');
                            renderList();
                        } else {
                            overlay.classList.remove('hidden');
                        }
                    };

                    row.appendChild(delBtn);

                    row.onclick = () => {
                        overlay.classList.add('hidden');
                        resolve(t);
                    };

                    listContainer.appendChild(row);
                });
                lucide.createIcons();
            };

            renderList();

            closeBtn.onclick = () => {
                overlay.classList.add('hidden');
                resolve(null);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                    resolve(null);
                }
            };

            addNewBtn.onclick = async () => {
                // Hide tag picker overlay temporary so modal pops up cleanly on top
                overlay.classList.add('hidden');
                const newTag = await this.app.showModal({
                    title: 'Create Custom Tag',
                    description: 'Enter a name for your new tag:',
                    isPrompt: true,
                    defaultValue: 'Feature'
                });
                if (newTag && newTag.trim() && !this.tagsList.includes(newTag.trim())) {
                    const tagName = newTag.trim();
                    const palettes = [
                        { text: 'text-sky-600 dark:text-sky-400 font-semibold', bg: 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300' },
                        { text: 'text-purple-600 dark:text-purple-400 font-semibold', bg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' },
                        { text: 'text-emerald-600 dark:text-emerald-400 font-semibold', bg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' },
                        { text: 'text-pink-600 dark:text-pink-400 font-semibold', bg: 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300' },
                        { text: 'text-amber-600 dark:text-amber-400 font-semibold', bg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' },
                        { text: 'text-indigo-600 dark:text-indigo-400 font-semibold', bg: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' }
                    ];
                    const chosen = palettes[Math.floor(Math.random() * palettes.length)];
                    this.tagsList.push(tagName);
                    this.tagColors[tagName] = chosen.text;
                    this.tagBadgeBg[tagName] = chosen.bg;
                    this.saveCustomTags();
                    resolve(tagName);
                } else {
                    overlay.classList.remove('hidden');
                }
            };
        });
    }

    renderTableView() {
        this.loadLocalTags();
        const tbody = document.getElementById('db-table-body');
        tbody.innerHTML = '';
        if (this.app.currentDBRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-slate-400">No database items.</td></tr>`;
            return;
        }

        this.app.currentDBRecords.forEach(rec => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 dark:hover:bg-zinc-800/40';

            tr.innerHTML = `
                <td class="p-2.5"><input type="text" value="${rec.title}" class="bg-transparent outline-none w-full font-medium" name="title" data-field="title"></td>
                <td class="p-2.5">
                    <button type="button" class="status-trigger-btn px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200 dark:border-zinc-700 outline-none flex items-center gap-1.5 shadow-sm transition ${this.getStatusBadgeBg(rec.status)}">
                        <span>${rec.status}</span>
                        <i data-lucide="chevron-down" class="w-3 h-3 opacity-60"></i>
                    </button>
                </td>
                <td class="p-2.5">
                    <button type="button" class="tag-trigger-btn px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200 dark:border-zinc-700 outline-none flex items-center gap-1.5 shadow-sm transition ${this.getTagBadgeBg(rec.tag)}">
                        <span>${rec.tag}</span>
                        <i data-lucide="chevron-down" class="w-3 h-3 opacity-60"></i>
                    </button>
                </td>
                <td class="p-2.5">
                    <button type="button" class="priority-trigger-btn px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200 dark:border-zinc-700 outline-none flex items-center gap-1.5 shadow-sm transition ${this.getPriorityBadgeBg(rec.priority)}">
                        <span>${rec.priority}</span>
                        <i data-lucide="chevron-down" class="w-3 h-3 opacity-60"></i>
                    </button>
                </td>
                <td class="p-2.5 text-right"><button class="del-rec p-1 text-slate-400 hover:text-red-500"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></td>
            `;

            tr.querySelector('[data-field="title"]').oninput = (e) => { rec.title = e.target.value; this.app.cloud.syncRecordUp(rec); };

            // Status Pop-up Trigger
            const statusTriggerBtn = tr.querySelector('.status-trigger-btn');
            statusTriggerBtn.onclick = async (e) => {
                e.stopPropagation();
                const selectedStatus = await this.showStatusPickerPopup(rec.status);
                if (selectedStatus && selectedStatus !== rec.status) {
                    rec.status = selectedStatus;
                    await this.app.cloud.syncRecordUp(rec);
                    this.renderTableView();
                }
            };

            // Tag Pop-up Trigger
            const tagTriggerBtn = tr.querySelector('.tag-trigger-btn');
            tagTriggerBtn.onclick = async (e) => {
                e.stopPropagation();
                const selectedTag = await this.showTagPickerPopup(rec.tag);
                if (selectedTag && selectedTag !== rec.tag) {
                    rec.tag = selectedTag;
                    await this.app.cloud.syncRecordUp(rec);
                    this.renderTableView();
                } else if (!this.tagsList.includes(rec.tag)) {
                    rec.tag = this.tagsList[0] || 'General';
                    await this.app.cloud.syncRecordUp(rec);
                    this.renderTableView();
                }
            };

            // Priority Pop-up Trigger
            const priorityTriggerBtn = tr.querySelector('.priority-trigger-btn');
            priorityTriggerBtn.onclick = async (e) => {
                e.stopPropagation();
                const selectedPriority = await this.showPriorityPickerPopup(rec.priority);
                if (selectedPriority && selectedPriority !== rec.priority) {
                    rec.priority = selectedPriority;
                    await this.app.cloud.syncRecordUp(rec);
                    this.renderTableView();
                }
            };

            tr.querySelector('.del-rec').onclick = async () => { await this.app.cloud.deleteRecordUp(rec.id); await this.app.loadDBRecords(this.app.activeItemId); };
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    }

    renderKanbanView() {
        this.loadLocalTags();
        const container = document.getElementById('kanban-columns-container');
        container.innerHTML = '';

        ['To Do', 'In Progress', 'Done'].forEach(status => {
            const col = document.createElement('div');
            col.className = 'bg-slate-100/70 dark:bg-zinc-900/80 rounded-lg p-3 space-y-3 min-h-[350px] border border-slate-200 dark:border-zinc-800 flex flex-col';
            
            const matching = this.app.currentDBRecords.filter(r => r.status === status);
            col.innerHTML = `
                <div class="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 pb-1 border-b border-slate-200 dark:border-zinc-800">
                    <span>${status}</span>
                    <span class="px-2 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded-full text-[10px]">${matching.length}</span>
                </div>
            `;

            const list = document.createElement('div');
            list.className = 'space-y-2 flex-1 kanban-drop-zone min-h-[280px]';
            list.setAttribute('data-status', status);

            matching.forEach(rec => {
                const card = document.createElement('div');
                card.className = 'bg-white dark:bg-zinc-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-zinc-700 space-y-2 cursor-grab active:cursor-grabbing hover:shadow transition';
                card.setAttribute('data-id', rec.id);
                card.innerHTML = `
                    <div class="font-medium text-xs text-slate-800 dark:text-slate-100">${rec.title}</div>
                    <div class="flex justify-between items-center text-[10px]">
                        <span class="px-2 py-0.5 rounded-md font-medium ${this.getTagBadgeBg(rec.tag)}">${rec.tag}</span>
                        <span class="font-medium ${this.getPriorityColor(rec.priority)}">${rec.priority}</span>
                    </div>
                `;
                list.appendChild(card);
            });

            col.appendChild(list);
            container.appendChild(col);

            if (window.Sortable) {
                Sortable.create(list, {
                    group: 'kanban-board',
                    animation: 150,
                    ghostClass: 'opacity-40',
                    onEnd: async (evt) => {
                        const cardId = evt.item.getAttribute('data-id');
                        const newStatus = evt.to.getAttribute('data-status');
                        const record = this.app.currentDBRecords.find(r => r.id === cardId);
                        if (record && record.status !== newStatus) {
                            record.status = newStatus;
                            await this.app.cloud.syncRecordUp(record);
                            this.app.channel.postMessage('sync');
                            this.renderKanbanView();
                        }
                    }
                });
            }
        });
    }

    renderGalleryView() {
        this.loadLocalTags();
        const container = document.getElementById('gallery-cards-container');
        container.innerHTML = '';
        if (this.app.currentDBRecords.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center p-6 text-slate-400 text-xs">No gallery items.</div>`;
            return;
        }
        this.app.currentDBRecords.forEach(rec => {
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 space-y-3 shadow-sm';
            card.innerHTML = `
                <div class="h-20 bg-gradient-to-tr from-sky-400 to-indigo-500 rounded-md flex items-center justify-center text-white font-bold text-lg">${rec.title.charAt(0)}</div>
                <h4 class="font-semibold text-xs truncate text-slate-800 dark:text-slate-100">${rec.title}</h4>
                <div class="flex gap-2 text-[10px] items-center">
                    <span class="px-2 py-0.5 rounded-md font-medium ${this.getTagBadgeBg(rec.tag)}">${rec.tag}</span>
                    <span class="font-medium ${this.getPriorityColor(rec.priority)}">${rec.priority}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

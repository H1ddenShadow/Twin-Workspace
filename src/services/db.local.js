// IndexedDB / LocalStorage Engine
export class LocalStorageEngine {
    constructor() {
        this.dbName = 'NotionWorkspaceDB';
    }
    async init() {
        if (!localStorage.getItem('notion_items')) {
            localStorage.setItem('notion_items', JSON.stringify([]));
        }
        if (!localStorage.getItem('notion_records')) {
            localStorage.setItem('notion_records', JSON.stringify([]));
        }
    }
    async getAllItems() {
        return JSON.parse(localStorage.getItem('notion_items')) || [];
    }
    async saveItem(item) {
        let items = await this.getAllItems();
        const idx = items.findIndex(i => i.id === item.id);
        if (idx >= 0) items[idx] = item;
        else items.push(item);
        localStorage.setItem('notion_items', JSON.stringify(items));
    }
    async deleteItem(id) {
        let items = await this.getAllItems();
        items = items.filter(i => i.id !== id && i.parentId !== id);
        localStorage.setItem('notion_items', JSON.stringify(items));
    }
    async getDBRecords(pageId) {
        const records = JSON.parse(localStorage.getItem('notion_records')) || [];
        return records.filter(r => r.pageId === pageId);
    }
    async saveRecord(record) {
        let records = JSON.parse(localStorage.getItem('notion_records')) || [];
        const idx = records.findIndex(r => r.id === record.id);
        if (idx >= 0) records[idx] = record;
        else records.push(record);
        localStorage.setItem('notion_records', JSON.stringify(records));
    }
    async deleteRecord(id) {
        let records = JSON.parse(localStorage.getItem('notion_records')) || [];
        records = records.filter(r => r.id !== id);
        localStorage.setItem('notion_records', JSON.stringify(records));
    }
}

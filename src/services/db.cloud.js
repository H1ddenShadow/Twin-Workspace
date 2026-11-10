// Cloud Sync Service (Supabase + Local Fallback)
import { supabase } from '../config/supabase.js';

export class CloudSyncService {
    constructor(localEngine) {
        this.local = localEngine;
        this.user = null;
    }
    async initSession(callback) {
        try {
            const { data } = await supabase.auth.getSession();
            this.user = data.session?.user || null;
            if (this.user) {
                await this.pullCloudData();
            }
            if (callback) callback(this.user);
            supabase.auth.onAuthStateChange(async (_event, session) => {
                this.user = session?.user || null;
                if (this.user) {
                    await this.pullCloudData();
                }
                if (callback) callback(this.user);
            });
        } catch (e) {
            console.warn('Supabase offline or not configured', e);
        }
    }
    async pullCloudData() {
        if (!this.user) return;
        try {
            // 1. Sync and reconcile items (including deletions & user tag configs)
            const { data: cloudItems, error: itemsErr } = await supabase.from('notion_items').select('*');
            if (!itemsErr && cloudItems) {
                const tagConfigItem = cloudItems.find(i => i.id === '__user_tags_config__');
                if (tagConfigItem && tagConfigItem.blocks) {
                    const tagData = tagConfigItem.blocks;
                    if (tagData.tagsList) localStorage.setItem('notion_custom_tags', JSON.stringify(tagData.tagsList));
                    if (tagData.tagColors) localStorage.setItem('notion_tag_colors', JSON.stringify(tagData.tagColors));
                    if (tagData.tagBadgeBg) localStorage.setItem('notion_tag_badge_bg', JSON.stringify(tagData.tagBadgeBg));
                }

                const filteredCloudItems = cloudItems.filter(i => i.id !== '__user_tags_config__');
                const cloudItemIds = new Set(filteredCloudItems.map(i => i.id));
                const localItems = await this.local.getAllItems();
                
                for (const localItem of localItems) {
                    if (!cloudItemIds.has(localItem.id)) {
                        await this.local.deleteItem(localItem.id);
                    }
                }
                for (const item of filteredCloudItems) {
                    await this.local.saveItem(item);
                }
            }

            // 2. Sync and reconcile database records (including deletions)
            const { data: cloudRecords, error: recsErr } = await supabase.from('notion_records').select('*');
            if (!recsErr && cloudRecords) {
                const cloudRecordIds = new Set(cloudRecords.map(r => r.id));
                const allPages = await this.local.getAllItems();
                for (const page of allPages) {
                    const localRecs = await this.local.getDBRecords(page.id);
                    for (const localRec of localRecs) {
                        if (!cloudRecordIds.has(localRec.id)) {
                            await this.local.deleteRecord(localRec.id);
                        }
                    }
                }
                for (const rec of cloudRecords) {
                    await this.local.saveRecord(rec);
                }
            }
        } catch (e) {
            console.warn('Failed to pull cloud data:', e);
        }
    }
    async syncCustomTagsUp(tagsList, tagColors, tagBadgeBg) {
        if (this.user) {
            try {
                await supabase.from('notion_items').upsert([{
                    id: '__user_tags_config__',
                    type: 'config',
                    title: 'User Custom Tags Configuration',
                    blocks: { tagsList, tagColors, tagBadgeBg },
                    updatedAt: new Date().toISOString()
                }]);
            } catch(e) {
                console.error('Sync custom tags error:', e);
            }
        }
    }
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
            if (signUpError) throw signUpError;
            return signUpData;
        }
        await this.pullCloudData();
        return data;
    }
    async signOut() {
        await supabase.auth.signOut();
        this.user = null;
    }
    async syncItemUp(item) {
        await this.local.saveItem(item);
        if (this.user) {
            try { await supabase.from('notion_items').upsert([item]); } catch(e) { console.error('Sync item error:', e); }
        }
    }
    async deleteItemUp(id) {
        await this.local.deleteItem(id);
        if (this.user) {
            try { await supabase.from('notion_items').delete().eq('id', id); } catch(e) { console.error('Delete item error:', e); }
        }
    }
    async syncRecordUp(record) {
        await this.local.saveRecord(record);
        if (this.user) {
            try { await supabase.from('notion_records').upsert([record]); } catch(e) { console.error('Sync record error:', e); }
        }
    }
    async deleteRecordUp(id) {
        await this.local.deleteRecord(id);
        if (this.user) {
            try { await supabase.from('notion_records').delete().eq('id', id); } catch(e) { console.error('Delete record error:', e); }
        }
    }
    // Subscribe to Supabase Database Changes across all devices
subscribeToRealtimeChanges(onSyncCallback) {
    if (!this.user) return;

    // Supabase Realtime listener for table mutation events
    supabase
        .channel('workspace-global-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notion_items' }, async () => {
            await this.pullCloudData();
            if (onSyncCallback) onSyncCallback();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notion_records' }, async () => {
            await this.pullCloudData();
            if (onSyncCallback) onSyncCallback();
        })
        .subscribe();

    // BroadcastChannel for instant local multi-tab synchronization
    const channel = new BroadcastChannel('notion_workspace_sync');
    channel.onmessage = async () => {
        await this.pullCloudData();
        if (onSyncCallback) onSyncCallback();
    };

    // Refocus event trigger (refreshes data when switching back to tab/app)
    window.addEventListener('focus', async () => {
        await this.pullCloudData();
        if (onSyncCallback) onSyncCallback();
    });
}
}

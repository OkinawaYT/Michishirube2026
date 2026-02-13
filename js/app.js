// Configuration
const MICHISHIRUBE_CONFIG = {
    api: {
        gasUrl: 'https://script.google.com/macros/s/AKfycbxp4QWR2tbqXd-Nvoli8FK3VyBatIMTlFwdaapiheqXVrbLUiHXFzgOy0rkHYGbb9RE/exec',
        githubBaseUrl: 'https://raw.githubusercontent.com/OkinawaYT/Michishirube2026/main/data',
        get masterUrl() {
            return `${this.githubBaseUrl}/master.json`;
        }
    },

    refresh: {
        liveDataInterval: 180000  // 3min
    },

    console: {
        styles: {
            primary: 'color: #2563eb; font-size: 14px; font-weight: bold;',
            success: 'color: #059669; font-size: 14px; font-weight: bold;',
            error: 'color: #dc2626; font-size: 14px; font-weight: bold;',
            warning: 'color: #ea580c; font-size: 12px;',
            info: 'color: #666; font-size: 12px;',
            debug: 'color: #999; font-size: 11px;',
            light: 'color: #dbeafe;'
        }
    },

    features: {
        enableLiveDataPolling: true,
        enableConsoleLogging: true
    }
};

if (typeof window !== 'undefined') {
    window.MICHISHIRUBE_CONFIG = MICHISHIRUBE_CONFIG;
}

function app() {
    return {
        activeTab: 'news',
        modalOpen: false,
        modalType: '',
        selectedItem: null,
        loading: true,

        sessions: [],
        speakers: [],
        timeline_structure: [],
        venues: [],

        notices: [],
        parking: [],

        selectedTags: [],
        speakerSearchQuery: '',
        timetableFilter: {
            venue: '',
            location: '',
            time: '',
            speaker: ''
        },

        async init() {
            const config = window.MICHISHIRUBE_CONFIG;

            if (config.features.enableConsoleLogging) {
                console.log('%c🚀 Init: Michishirube2026', config.console.styles.primary);
            }

            await this.loadMasterData(config);
            await this.loadLiveData(config);

            this.loading = false;

            if (config.features.enableConsoleLogging) {
                console.log('%c✨ Ready', config.console.styles.primary);
            }

            if (config.features.enableLiveDataPolling) {
                setInterval(() => this.refreshLiveData(), config.refresh.liveDataInterval);
            }
        },

        async loadMasterData(config) {
            if (config.features.enableConsoleLogging) {
                console.log('%c📡 Fetching: Master Data', config.console.styles.info);
            }

            try {
                const timestamp = Date.now();
                const urlWithCache = `${config.api.masterUrl}?t=${timestamp}`;

                if (config.features.enableConsoleLogging) {
                    console.log('%c⏱️ Cache bust: ' + timestamp, config.console.styles.debug);
                }

                const response = await fetch(urlWithCache);

                if (config.features.enableConsoleLogging) {
                    const statusStyle = response.ok ? config.console.styles.success : config.console.styles.error;
                    console.log('%c📊 Response: ' + response.status, statusStyle);
                }

                if (!response.ok) {
                    throw new Error(`GitHub HTTP ${response.status}: ${response.statusText}`);
                }

                const master = await response.json();

                if (config.features.enableConsoleLogging) {
                    console.log('%c📄 Parsed', config.console.styles.success, master);
                }

                this.sessions = master.sessions || [];
                this.speakers = master.speakers || [];
                this.timeline_structure = master.timeline_structure || [];
                this.venues = master.venues || [];

                if (config.features.enableConsoleLogging) {
                    console.log(`%c✅ Master loaded`, config.console.styles.success);
                    console.log(`   📋 Sessions: ${this.sessions.length}`);
                    console.log(`   👤 Speakers: ${this.speakers.length}`);
                    console.log(`   🏢 Venues: ${this.venues.length}`);
                    console.log(`   ⏰ Timeslots: ${this.timeline_structure.length}`);

                    if (this.sessions.length > 0) {
                        console.log('%c📌 Sample:', config.console.styles.light, this.sessions[0]);
                    }
                }
            } catch (err) {
                if (config.features.enableConsoleLogging) {
                    console.error('%c❌ Master load failed', config.console.styles.error, err);
                    console.error('Details:', err.message);
                }

                this.sessions = [];
                this.speakers = [];
                this.timeline_structure = [];
                this.venues = [];
            }
        },

        async loadLiveData(config) {
            try {
                if (config.features.enableConsoleLogging) {
                    console.log('%c📡 Fetching: Live data (GAS)', config.console.styles.info);
                }

                const response = await fetch(config.api.gasUrl + '?t=' + Date.now());

                if (!response.ok) {
                    throw new Error(`GAS HTTP ${response.status}`);
                }

                const live = await response.json();
                this.notices = live.notices || [];
                this.parking = live.parking || [];

                if (config.features.enableConsoleLogging) {
                    console.log(`%c✅ Live loaded`, config.console.styles.success);
                    console.log(`   📢 Notices: ${this.notices.length}`);
                    console.log(`   🅿️ Parking: ${this.parking.length}`);
                    if (live.cacheAge >= 0) {
                        console.log(`   ⏰ Cache age: ${live.cacheAge}s`);
                    }
                }
            } catch (err) {
                if (config.features.enableConsoleLogging) {
                    console.warn('%c⚠️ Live load failed', config.console.styles.warning, err.message);
                }

                this.notices = [];
                this.parking = [];
            }
        },

        async refreshLiveData() {
            const config = window.MICHISHIRUBE_CONFIG;

            try {
                const response = await fetch(config.api.gasUrl + '?t=' + Date.now());

                if (response.ok) {
                    const data = await response.json();

                    if (data && !data.error) {
                        this.notices = data.notices || [];
                        this.parking = data.parking || [];

                        if (config.features.enableConsoleLogging) {
                            console.log('🔄 Refreshed (cache: ' + data.cacheAge + 's)');
                        }
                    }
                }
            } catch (err) {
                if (config.features.enableConsoleLogging) {
                    console.warn('⚠️ Refresh failed:', err.message);
                }
            }
        },

        get filteredSpeakers() {
            if (!this.speakerSearchQuery.trim()) return this.speakers;

            const query = this.speakerSearchQuery.toLowerCase();
            return this.speakers.filter(s =>
                s.name.toLowerCase().includes(query) ||
                s.affiliation.toLowerCase().includes(query) ||
                s.kana.toLowerCase().includes(query)
            );
        },

        get uniqueVenues() {
            const venueIds = [...new Set(this.sessions.map(s => s.venue_id))];
            return this.venues.filter(v => venueIds.includes(v.id)).sort((a, b) => a.id.localeCompare(b.id));
        },

        get uniqueTimes() {
            const times = [...new Set(this.sessions.map(s => s.time))];
            return times.sort();
        },

        get uniqueSpeakerNames() {
            const names = new Set();
            this.sessions.forEach(s => {
                s.speaker_ids?.forEach(id => {
                    const speaker = this.speakers.find(sp => sp.id === id);
                    if (speaker) names.add(speaker.name);
                });
            });
            return Array.from(names).sort();
        },

        get filteredTimeline() {
            return this.timeline_structure.filter(slot => {
                if (this.timetableFilter.time && this.timetableFilter.time !== slot.time_range) {
                    return false;
                }
                if (!slot.is_parallel) return true;
                return this.getFilteredSessionsByTime(slot.time_range).length > 0;
            });
        },

        getFilteredSessionsByTime(time) {
            let filtered = this.sessions.filter(s => s.time === time);

            if (this.timetableFilter.venue) {
                filtered = filtered.filter(s => s.venue_id === this.timetableFilter.venue);
            }

            if (this.timetableFilter.location) {
                const venue = this.venues.find(v => v.id === this.timetableFilter.location);
                if (venue) {
                    filtered = filtered.filter(s => s.venue_id === venue.id);
                }
            }

            if (this.timetableFilter.time && this.timetableFilter.time !== time) {
                filtered = [];
            }

            if (this.timetableFilter.speaker) {
                filtered = filtered.filter(s =>
                    s.speaker_ids?.some(id => {
                        const speaker = this.speakers.find(sp => sp.id === id);
                        return speaker?.name === this.timetableFilter.speaker;
                    })
                );
            }

            return filtered;
        },

        resetTimetableFilter() {
            this.timetableFilter = { venue: '', location: '', time: '', speaker: '' };
        },

        get allTags() {
            const tags = new Set();
            this.sessions.forEach(s => {
                if (Array.isArray(s.hashtags)) {
                    s.hashtags.forEach(t => tags.add(t));
                }
            });
            return Array.from(tags).sort();
        },

        get dynamicAvailableTags() {
            if (this.selectedTags.length === 0) return this.allTags;

            const matchingSessions = this.sessions.filter(s => {
                if (!Array.isArray(s.hashtags)) return false;
                return this.selectedTags.some(tag => s.hashtags.includes(tag));
            });

            const availableTags = new Set();
            matchingSessions.forEach(s => {
                if (Array.isArray(s.hashtags)) {
                    s.hashtags.forEach(t => availableTags.add(t));
                }
            });

            return Array.from(availableTags).sort();
        },

        get filteredSessions() {
            if (this.selectedTags.length === 0) return this.sessions;

            return this.sessions.filter(s => {
                if (!Array.isArray(s.hashtags)) return false;
                return this.selectedTags.some(tag => s.hashtags.includes(tag));
            });
        },

        toggleTag(tag) {
            const idx = this.selectedTags.indexOf(tag);
            if (idx > -1) {
                this.selectedTags.splice(idx, 1);
            } else {
                this.selectedTags.push(tag);
            }
        },

        getSessionsByTime(time) {
            return this.sessions.filter(s => s.time === time);
        },

        getSpeaker(id) {
            return this.speakers.find(s => s.id === id) || {
                id: 'unknown',
                name: 'Unknown',
                kana: '',
                affiliation: '',
                image: ''
            };
        },

        getSessionsBySpeaker(sid) {
            return this.sessions.filter(s =>
                Array.isArray(s.speaker_ids) && s.speaker_ids.includes(sid)
            );
        },

        openSession(s) {
            this.selectedItem = s;
            this.modalType = 'session';
            this.modalOpen = true;

            const config = window.MICHISHIRUBE_CONFIG;
            if (config.features.enableConsoleLogging) {
                console.log('📌 Session:', s.id, s.title);
            }
        },

        openSpeaker(sp) {
            this.selectedItem = sp;
            this.modalType = 'speaker';
            this.modalOpen = true;

            const config = window.MICHISHIRUBE_CONFIG;
            if (config.features.enableConsoleLogging) {
                console.log('👤 Speaker:', sp.id, sp.name);
            }
        }
    }
}


const express = require('express');
const fs = require('fs');
const session = require('express-session');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'vim-super-league-2025-stable',
    resave: false,
    saveUninitialized: true
}));

const DATA_FILE = './data.json';
const ADMIN_KEY = "VIM-STAFF-2025"; 

const getData = () => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return { 
            players: [], matches: [], liveLink: "", groups: [], 
            leaderboards: { scorers: [], saves: [], assists: [] }, 
            records: [], 
            ...data 
        };
    } catch (e) {
        return { players: [], matches: [], liveLink: "", groups: [], leaderboards: { scorers: [], saves: [], assists: [] }, records: [] };
    }
};

const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

app.use((req, res, next) => {
    const data = getData();
    res.locals = { ...res.locals, ...data, isAdmin: req.session.isAdmin || false, page: "" };
    next();
});

// --- PAGES ---
app.get('/', (req, res) => res.render('index', { page: 'home' }));
app.get('/market', (req, res) => res.render('market', { page: 'market' }));
app.get('/matches', (req, res) => res.render('matches', { page: 'matches' }));
app.get('/metrics', (req, res) => res.render('metrics', { page: 'metrics' }));
app.get('/league-records', (req, res) => res.render('league-records', { page: 'records' }));
app.get('/admin-login', (req, res) => res.render('admin-login', { error: null, page: 'admin' }));

app.get('/team/:groupId/:teamIndex', (req, res) => {
    const data = getData();
    const group = data.groups.find(g => g.id == req.params.groupId);
    const team = group ? group.teams[req.params.teamIndex] : null;
    if (!team) return res.redirect('/metrics');
    res.render('team-details', { team: team, group: group, page: 'metrics' });
});

app.get('/admin', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin-login');
    res.render('admin', { page: 'admin', error: req.query.error || null });
});

// --- ADMIN POST ROUTES ---

// 1. THIS IS THE ONE THAT WAS CRASHING (The "Update Database Entry" button)
app.post('/admin/update-market-player', (req, res) => {
    if (!req.session.isAdmin) return res.status(403).send("Unauthorized");
    const data = getData();
    const { username, goals, assists, saves, mvps, bio } = req.body;
    
    // Find player by name (case sensitive to match your admin.ejs)
    const pIdx = data.players.findIndex(p => p.name === username);
    
    if (pIdx !== -1) {
        data.players[pIdx].goals = parseInt(goals) || 0;
        data.players[pIdx].assists = parseInt(assists) || 0;
        data.players[pIdx].saves = parseInt(saves) || 0;
        data.players[pIdx].mvps = parseInt(mvps) || 0;
        data.players[pIdx].bio = bio; 
        saveData(data);
        res.redirect('/admin'); // Redirect back to dashboard after saving
    } else {
        res.redirect('/admin?error=Player+Not+Found');
    }
});

app.post('/admin-login', (req, res) => {
    if (req.body.password === ADMIN_KEY) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('admin-login', { error: "WRONG KEY!", page: 'admin' });
    }
});

app.post('/admin/add-record', (req, res) => {
    const data = getData();
    data.records.push({ id: Date.now(), ...req.body });
    saveData(data);
    res.redirect('/admin');
});

app.post('/admin/delete-record', (req, res) => {
    const data = getData();
    data.records = data.records.filter(r => r.id != req.body.recordId);
    saveData(data);
    res.redirect('/admin');
});

app.post('/admin/live', (req, res) => {
    const data = getData();
    data.liveLink = req.body.link;
    saveData(data);
    res.redirect('/admin');
});

app.post('/admin/add-match', (req, res) => {
    const data = getData();
    data.matches.push({ id: Date.now(), ...req.body });
    saveData(data);
    res.redirect('/admin');
});

app.post('/admin/delete-player', (req, res) => {
    const data = getData();
    data.players = data.players.filter(p => p.id != req.body.playerId);
    saveData(data);
    res.redirect('/admin');
});

app.post('/admin/add-group', (req, res) => {
    const data = getData();
    data.groups.push({ id: Date.now(), name: req.body.name, teams: [] });
    saveData(data);
    res.redirect('/admin');
});

app.post('/admin/delete-group', (req, res) => {
    const data = getData();
    data.groups = data.groups.filter(g => g.id != req.body.groupId);
    saveData(data);
    res.redirect('/admin');
});

app.post('/admin/update-team', (req, res) => {
    const data = getData();
    const { groupId, teamIndex, teamName, logo, mp, wins, loses, pts } = req.body;
    const group = data.groups.find(g => g.id == groupId);
    if (group) {
        if (teamIndex !== "" && teamIndex !== undefined && group.teams[teamIndex]) {
            group.teams[teamIndex].mp = mp;
            group.teams[teamIndex].wins = wins;
            group.teams[teamIndex].loses = loses;
            group.teams[teamIndex].pts = pts;
        } else if (teamName) {
            group.teams.push({ name: teamName, logo: logo, mp: 0, wins: 0, loses: 0, pts: 0, roster: [] });
        }
    }
    saveData(data);
    res.redirect('/admin');
});

app.post('/admin/add-to-roster', (req, res) => {
    const data = getData();
    const { groupId, teamIndex, playerName, isManager } = req.body;
    const group = data.groups.find(g => g.id == groupId);
    const team = group ? group.teams[teamIndex] : null;
    if (team) {
        if (!team.roster) team.roster = [];
        team.roster.push({ name: playerName, isManager: isManager === "true" });
        saveData(data);
    }
    res.redirect('/admin');
});

app.post('/admin/delete-from-roster', (req, res) => {
    const data = getData();
    const { groupId, teamIndex, playerIndex } = req.body;
    const group = data.groups.find(g => g.id == groupId);
    if (group && group.teams[teamIndex]) {
        group.teams[teamIndex].roster.splice(playerIndex, 1);
        saveData(data);
    }
    res.redirect('/admin');
});

app.post('/admin/update-stat', (req, res) => {
    const data = getData();
    const { type, statIndex, playerName, value } = req.body;
    if (data.leaderboards[type]) {
        if (statIndex !== "" && statIndex !== undefined && data.leaderboards[type][statIndex]) {
            data.leaderboards[type][statIndex].value = value;
        } else if (playerName) {
            data.leaderboards[type].push({ name: playerName, value: value });
        }
        data.leaderboards[type].sort((a, b) => b.value - a.value);
    }
    saveData(data);
    res.redirect('/admin');
});

app.post('/admin/delete-stat', (req, res) => {
    const data = getData();
    if (data.leaderboards[req.body.type]) data.leaderboards[req.body.type].splice(req.body.statIndex, 1);
    saveData(data);
    res.redirect('/admin');
});

app.post('/register', (req, res) => {
    const data = getData();
    data.players.push({ 
        id: Date.now(), 
        ...req.body, 
        goals: 0, 
        assists: 0, 
        saves: 0, 
        mvps: 0, 
        bio: "" 
    });
    saveData(data);
    res.redirect('/market');
});
// Render provides the port via process.env.PORT. Default to 3000 for local testing.
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`VIM Hub is LIVE on port ${PORT}`);
});
